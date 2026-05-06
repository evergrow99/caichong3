export function getErrorMessage(error: unknown, fallback = "请求失败") {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message === "fetch failed" || error.message.includes("fetch failed")) {
    return "暂时无法连接外部服务，请稍后重试。";
  }

  if (error.message.includes("UND_ERR_CONNECT_TIMEOUT") || error.message.includes("ETIMEDOUT")) {
    return "外部服务连接超时，请稍后重试。";
  }

  return error.message || fallback;
}
