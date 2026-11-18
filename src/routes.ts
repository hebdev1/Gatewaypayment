export function readRoute() {
  const hash = window.location.hash.slice(1)
  const [path = '/', query = ''] = (hash.startsWith('/') ? hash : '/').split('?')
  return { path, params: new URLSearchParams(query) }
}

export function catalogLink(category = 'All', search = '') {
  const params = new URLSearchParams()
  if (category !== 'All') params.set('category', category)
  if (search.trim()) params.set('q', search.trim())
  return params.size ? `#/catalog?${params}` : '#/catalog'
}

export function navigate(href: string) {
  if (window.location.hash === href) window.scrollTo(0, 0)
  else window.location.hash = href
}
