export const languageMap = {
  1: "Hindi",
  2: "English",
  3: "Punjabi",
  4: "Tamil",
  5: "Telugu",
  6: "English",
  7: "Marathi",
  8: "Bengali",
  9: "Gujarati",
  10: "Kannada",
  11: "Malayalam",
  12: "Odia"
};

export const categoryMap = {
  5: "Entertainment",
  6: "Movies",
  10: "Infotainment",
  16: "Business"
};

export function mapLang(id) {
  return languageMap[id] || "Unknown";
}

export function mapCategory(id) {
  return categoryMap[id] || "Other";
}
