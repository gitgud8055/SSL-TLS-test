async function login() {
  try {
    const response = await fetch('/api/login', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({username: $("#input-user").prop('value'), password: $("#input-password").prop('value')})
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message);
    }
    const Newdir = await response.json();
    document.location.href = Newdir;
  }
  catch (err) {
    alert('Error: '+ err.message);
  }
}

$(document).ready(function() {
  $("#sp").click(function() {
    let cur = $("#sp input");
    if ($("#input-password").attr("type") === "password") {
      cur.prop('checked', true);
      $("#input-password").attr("type", "text");
    }
    else {
      cur.prop('checked', false);
      $("#input-password").attr("type", "password");
    }
  });
  $("#login-button").click(login);
  $(document).on('keydown', (event) => {
    if (event.key === "Enter") {
      $("#login-button").trigger('click');
    }
  });
});