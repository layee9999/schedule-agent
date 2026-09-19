export function isEmbed(): boolean {
  return new URLSearchParams(window.location.search).get('embed') === '1'
}

export function isInIframe(): boolean {
  return window.parent !== window
}
