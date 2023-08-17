import { HTTPException } from "hono/http-exception";
import * as state from "./globalState.js";

export async function waitOrThrow (model: string, MAX_CONNECT_PER_UPSTREAM?: string, TIMEOUT?: string, WAIT_FOR?: string) {
  const maxConnection = parseInt(MAX_CONNECT_PER_UPSTREAM ?? "1");
  // timeout in milliseconds, default to 10 minutes
  const timeout = parseInt(TIMEOUT ?? "600000");
  const waitFor = parseInt(WAIT_FOR ?? "5000");
  let waiting = 0;
  console.group(`wait or thorow model: ${model}`);
  // keep waiting if there is no free (connections < MAX_CONNECT_PER_UPSTREAM) upstream with the matching model
  while (
    state.filterByModel(model).filter(({ connections }) => connections < maxConnection).length === 0
  ) {
    console.info(`waiting ${waitFor}ms for a free upstream with model ${model}...`);
    await new Promise((resolve) => setTimeout(resolve, waitFor));
    waiting += 1000;
    if (waiting >= timeout) {
      console.error(`timeout (${timeout}) waiting for a free upstream`);
      console.groupEnd();
      throw new HTTPException(503, { message: "Timeout waiting for a free upstream, try again later" });
    }
  }
  console.groupEnd();
}
