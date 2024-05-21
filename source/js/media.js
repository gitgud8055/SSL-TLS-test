function media_query(condition, f) {
  const query = window.matchMedia(condition);
  f(query);
  query.addEventListener('change', () => {f(query);});
}