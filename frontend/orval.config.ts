import { defineConfig } from "orval";

export default defineConfig({
  ikkApi: {
    input: {
      target: "../backend/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "src/api/endpoints",
      schemas: "src/api/model",
      client: "react-query",
      mock: false,
    },
  },
});
