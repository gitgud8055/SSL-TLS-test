$("#search-form").on('submit', async function(event) {
  event.preventDefault();
  await fetch('/api/search', {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({command: $("#search").val()})})
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    return response.json();
  }).then(data => {console.log(data);}).catch(err => {alert(err);});
});