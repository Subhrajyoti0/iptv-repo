import fs from "fs";
import path from "path";

export function saveReview(data, file = "output/review.json") {
  const dir = path.dirname(file);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

  console.log(`✅ Review file saved: ${file}`);
}
