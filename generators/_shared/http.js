import axios from "axios";

const UA = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Mozilla/5.0 (Linux; Android 10)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
];

export function createClient() {
  return axios.create({
    timeout: 15000,
    headers: {
      "User-Agent": UA[Math.floor(Math.random() * UA.length)]
    }
  });
}
