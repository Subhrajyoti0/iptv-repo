export function formatDate(d) {
  return new Date(d)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "")
    .split(".")[0] + " +0000";
}
