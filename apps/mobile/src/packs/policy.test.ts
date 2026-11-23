import { decideDownload } from "./policy";

test("Wi-Fi downloads without asking", async () => {
  const confirm = jest.fn(async () => false);
  await expect(decideDownload("wifi", confirm)).resolves.toBe(true);
  expect(confirm).not.toHaveBeenCalled();
});

test("cellular asks the callback", async () => {
  await expect(decideDownload("cellular", async () => false)).resolves.toBe(false);
  await expect(decideDownload("cellular", async () => true)).resolves.toBe(true);
});

test("offline does not download", async () => {
  await expect(decideDownload("none", async () => true)).resolves.toBe(false);
});
