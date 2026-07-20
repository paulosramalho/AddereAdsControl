export const FB_GRAPH_BASE = "https://graph.facebook.com/v22.0";

const EXPIRED_SUBCODES = new Set([458, 459, 460, 463, 467]);

export function metaGraphErrorToHealth(error) {
  const message = error?.message ?? "Erro retornado pela Meta";
  const lowerMessage = message.toLowerCase();
  const code = error?.code;
  const subcode = error?.error_subcode;

  if (
    code === 190 &&
    (EXPIRED_SUBCODES.has(subcode) ||
      lowerMessage.includes("expired") ||
      lowerMessage.includes("expirado") ||
      lowerMessage.includes("expirou"))
  ) {
    return { status: "expired", error: message, metaCode: code, metaSubcode: subcode };
  }

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permissions") ||
    lowerMessage.includes("must be granted") ||
    lowerMessage.includes("permiss") ||
    code === 10 ||
    code === 200
  ) {
    return { status: "permission", error: message, metaCode: code, metaSubcode: subcode };
  }

  if (code === 190) {
    return { status: "invalid", error: message, metaCode: code, metaSubcode: subcode };
  }

  return { status: "error", error: message, metaCode: code, metaSubcode: subcode };
}

export async function fetchMetaGraph(path, accessToken) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(
    `${FB_GRAPH_BASE}/${path}${separator}access_token=${encodeURIComponent(accessToken)}`
  );
  return { response, data: await response.json() };
}
