// Trunca uma string por code point (não por unidade UTF-16), preservando
// pares surrogate. Cortar com String.prototype.slice pode partir um emoji ao
// meio e deixar um surrogate órfão, gerando JSON inválido ao serializar o
// corpo de uma request (ex.: 400 "no low surrogate in string" na API da
// Anthropic / Resend). Array.from itera por code point e mantém o emoji inteiro.
export function truncateSafe(str, max) {
  if (str == null) return str;
  const chars = Array.from(str);
  return chars.length <= max ? str : chars.slice(0, max).join("");
}
