// Mock data for development/testing
// Salt Lake City, Utah locations

export const MOCK_LOCATIONS = [
  {
    id: 'loc-1',
    name: 'Temple Square',
    latitude: 40.7704,
    longitude: -111.8922,
    radius: 50,
    haptic_trigger_distance: 100,
    audio_file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    story_segment_id: 'seg-1',
    story_chapter_number: 1,
    story_segment_title: 'Chapter 1: The Beginning',
    story_segment_description: 'Your journey begins at the heart of the city...',
    prerequisite_location_id: null, // First location - always unlocked
  },
  {
    id: 'loc-2',
    name: 'Liberty Park',
    latitude: 40.7424,
    longitude: -111.8710,
    radius: 50,
    haptic_trigger_distance: 100,
    audio_file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    story_segment_id: 'seg-2',
    story_chapter_number: 2,
    story_segment_title: 'Chapter 2: Discovery',
    story_segment_description: 'You discover something unexpected in the park...',
    prerequisite_location_id: 'loc-1',
  },
  {
    id: 'loc-3',
    name: 'Red Butte Garden',
    latitude: 40.7947,
    longitude: -111.8200,
    radius: 50,
    haptic_trigger_distance: 100,
    audio_file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    story_segment_id: 'seg-3',
    story_chapter_number: 3,
    story_segment_title: 'Chapter 3: The Revelation',
    story_segment_description: 'The truth is revealed among the gardens...',
    prerequisite_location_id: 'loc-2',
  },
];

export const MOCK_GEOFENCES = [
  {
    id: 'geofence-1',
    name: 'Downtown Salt Lake City',
    center_latitude: 40.7704,
    center_longitude: -111.8922,
    radius: 1000, // 1 kilometer
    background_soundtrack_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    background_volume: 0.2,
    fade_in_duration: 10000,
    fade_out_duration: 10000,
    loop: true,
    priority: 1,
  },
  {
    id: 'geofence-2',
    name: 'Liberty Park Area',
    center_latitude: 40.7424,
    center_longitude: -111.8710,
    radius: 500, // 500 meters
    background_soundtrack_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    background_volume: 0.25,
    fade_in_duration: 10000,
    fade_out_duration: 10000,
    loop: true,
    priority: 2,
  },
];

export const MOCK_STORY_SEGMENTS = [
  {
    id: 'seg-1',
    location_id: 'loc-1',
    chapter_number: 1,
    segment_title: 'Chapter 1: The Beginning',
    segment_description: 'You arrive at Temple Square, the heart of Salt Lake City, where your journey begins...',
    audio_file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    navigation_instructions: 'Head south toward Liberty Park. Follow Main Street and turn east on 900 South.',
    next_location_description: 'Look for Liberty Park, a large urban park with a pond.',
    directional_hints: 'Travel south for about 2 miles.',
    distance_to_next: 2.0,
    distance_unit: 'miles',
    previous_segment_id: null,
    next_segment_id: 'seg-2',
  },
  {
    id: 'seg-2',
    location_id: 'loc-2',
    chapter_number: 2,
    segment_title: 'Chapter 2: Discovery',
    segment_description: 'As you explore Liberty Park, you discover something hidden among the trees...',
    audio_file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    navigation_instructions: 'Head northeast toward the foothills. Follow Foothill Drive to Wakara Way.',
    next_location_description: 'Red Butte Garden, a beautiful botanical garden in the foothills.',
    directional_hints: 'Travel northeast for about 4.3 miles into the foothills.',
    distance_to_next: 4.3,
    distance_unit: 'miles',
    previous_segment_id: 'seg-1',
    next_segment_id: 'seg-3',
  },
  {
    id: 'seg-3',
    location_id: 'loc-3',
    chapter_number: 3,
    segment_title: 'Chapter 3: The Revelation',
    segment_description: 'High in the gardens with a view of the valley, the truth is finally revealed...',
    audio_file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    navigation_instructions: 'This is the end of your journey. Take in the view and reflect on what you have discovered.',
    next_location_description: null,
    directional_hints: null,
    distance_to_next: null,
    previous_segment_id: 'seg-2',
    next_segment_id: null,
  },
];

export default {
  MOCK_LOCATIONS,
  MOCK_GEOFENCES,
  MOCK_STORY_SEGMENTS,
};
