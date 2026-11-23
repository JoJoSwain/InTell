import { assetObjectPath, publicMediaUrl } from "./mediaUrl";

test("audio and images use the public object prefixes", () => {
  expect(assetObjectPath("narration", "abc", "wav")).toBe("a/abc.wav");
  expect(assetObjectPath("image", "abc", "png")).toBe("i/abc.png");
  expect(publicMediaUrl("http://127.0.0.1:54321/", "a/abc.wav")).toBe(
    "http://127.0.0.1:54321/storage/v1/object/public/public-media/a/abc.wav",
  );
});
