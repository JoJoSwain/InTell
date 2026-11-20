-- M3a: required time_window on ambience_layers and music_cues; scrub music conditions;
-- remap time_window enum to day/night only (A24)

-- ---------------------------------------------------------------------------
-- Split ambience_layers.time_windows[] → time_window scalar
-- Duplicate rows when both day and night apply; map dawn→day, dusk→night.
-- ---------------------------------------------------------------------------
alter table public.ambience_layers
  add column if not exists time_window public.time_window;

-- Temporary helper: expand each layer into day and/or night rows
do $$
declare
  layer record;
  want_day boolean;
  want_night boolean;
  new_id uuid;
begin
  -- Only rows not yet assigned (clones insert with time_window already set)
  for layer in
    select * from public.ambience_layers where time_window is null
  loop
    want_day := exists (
      select 1 from unnest(layer.time_windows) w
      where w::text in ('dawn', 'day')
    );
    want_night := exists (
      select 1 from unnest(layer.time_windows) w
      where w::text in ('dusk', 'night')
    );

    -- Empty / unexpected: default to day
    if not want_day and not want_night then
      want_day := true;
    end if;

    if want_day and want_night then
      -- Keep original as day; insert a night clone (+ assets)
      update public.ambience_layers
         set time_window = 'day'::public.time_window
       where id = layer.id;

      new_id := gen_random_uuid();
      insert into public.ambience_layers (
        id, profile_id, name, kind,
        gain_db_min, gain_db_max, pan_min, pan_max,
        pitch_cents_min, pitch_cents_max,
        mean_interval_s, min_interval_s, max_concurrent, no_repeat_last,
        crossfade_ms, time_windows, months, speaker_safe, wildlife_call, nesting_mute_months,
        time_window, created_at, updated_at
      )
      values (
        new_id, layer.profile_id, layer.name || ' (night)', layer.kind,
        layer.gain_db_min, layer.gain_db_max, layer.pan_min, layer.pan_max,
        layer.pitch_cents_min, layer.pitch_cents_max,
        layer.mean_interval_s, layer.min_interval_s, layer.max_concurrent, layer.no_repeat_last,
        layer.crossfade_ms, layer.time_windows, layer.months, layer.speaker_safe,
        layer.wildlife_call, layer.nesting_mute_months,
        'night'::public.time_window, layer.created_at, now()
      );

      insert into public.ambience_layer_assets (layer_id, asset_id, weight)
      select new_id, asset_id, weight
      from public.ambience_layer_assets
      where layer_id = layer.id;

    elsif want_day then
      update public.ambience_layers
         set time_window = 'day'::public.time_window
       where id = layer.id;
    else
      update public.ambience_layers
         set time_window = 'night'::public.time_window
       where id = layer.id;
    end if;
  end loop;
end $$;

alter table public.ambience_layers
  alter column time_window set not null;

alter table public.ambience_layers
  drop column if exists time_windows;

-- ---------------------------------------------------------------------------
-- music_cues.time_window + scrub conditions keys ringIds / outcome / timeWindows
-- ---------------------------------------------------------------------------
alter table public.music_cues
  add column if not exists time_window public.time_window;

update public.music_cues
   set time_window = 'day'::public.time_window
 where time_window is null;

alter table public.music_cues
  alter column time_window set not null;

alter table public.music_cues
  alter column time_window set default 'day'::public.time_window;

update public.music_cues
   set conditions = conditions - 'ringIds' - 'outcome' - 'timeWindows'
 where conditions ? 'ringIds'
    or conditions ? 'outcome'
    or conditions ? 'timeWindows';

-- ---------------------------------------------------------------------------
-- Remap time_window enum: drop dawn/dusk (A24)
-- Columns using it: revision_versions, ambience_layers, music_cues
-- ---------------------------------------------------------------------------
create type public.time_window_new as enum ('day', 'night');

alter table public.revision_versions
  alter column time_window drop default;

alter table public.revision_versions
  alter column time_window type public.time_window_new
  using (
    case time_window::text
      when 'night' then 'night'::public.time_window_new
      when 'dusk' then 'night'::public.time_window_new
      else 'day'::public.time_window_new
    end
  );

alter table public.revision_versions
  alter column time_window set default 'day'::public.time_window_new;

alter table public.ambience_layers
  alter column time_window type public.time_window_new
  using (
    case time_window::text
      when 'night' then 'night'::public.time_window_new
      when 'dusk' then 'night'::public.time_window_new
      else 'day'::public.time_window_new
    end
  );

alter table public.music_cues
  alter column time_window drop default;

alter table public.music_cues
  alter column time_window type public.time_window_new
  using (
    case time_window::text
      when 'night' then 'night'::public.time_window_new
      when 'dusk' then 'night'::public.time_window_new
      else 'day'::public.time_window_new
    end
  );

alter table public.music_cues
  alter column time_window set default 'day'::public.time_window_new;

drop type public.time_window;
alter type public.time_window_new rename to time_window;
