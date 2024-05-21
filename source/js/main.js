const month_name = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let month, year, day;
let booked = Array.from({length: 32}, () => []);

function malding(i) {
  $("#LKJfwaufLj").html(`${i}/${month+1}/${year}`);
  $("#detail").html("");
  booked[i].forEach((data, idx) => {
    $("#detail").append( `<div class="container p-2 my-1 w-[384px]">
    <div class="flex w-full">
      <span class="fs-4 fw-bold mr-auto">${data.start} - ${data.end}</span>
      <button class="ml-auto btn btn-light" data-alias="${data.Mid}" id="aAkeKik${idx}"> <ion-icon name="pencil-outline"></ion-icon></button>
    </div>
    <div>
      <span>Nội dung: </span>
      <span>${data.note}</span>
    </div>
  </div>\n`);
    $(`#aAkeKik${idx}`).click(() => {
      $("#cdate").val(`${year}-${(month + 1).toString().padStart(2, "0")}-${i.toString().padStart(2, "0")}`);
      $("#stime").val(data.start);
      $("#etime").val(data.end);
      $("#desc").val(data.note);
      $("#mid").val(data.Mid);
      $("#file-input").val("");
      $("#file-preview, #fdWjfkwiA").html("");
      $("#cc").show();
      fetch(`/api/book/${data.Mid}`, {method: "GET"})
      .then(async function(response) {
				if (!response.ok) {
					let x = await response.json();
					throw new Error(`Error: ${x.message}`);
				}
				return response.json();
			}).then(data => {
        const cur = $("#old");
        cur.html("");
        console.log(data);
        data.data.forEach((item) => {
          cur.append(`<div class="m-1 px-1 rounded flex flex-row cursor-pointer" style="border: 1px solid black;" data-id="${item.path}"><div class="CjQWonTasj">${item.name}</div><button type="button" ><ion-icon name="close-outline"></ion-icon></button></div>`)
        });
        $("#old .CjQWonTasj").click(function() {
          window.location.href = (`/api/download?l=${$(this).parent().attr("data-id")}&n=${$(this).text()}`);
        })
        $("#old button").click(function() {
          $("#fdWjfkwiA").append(`<input type="hidden" name="pl[]">`);
          $("#fdWjfkwiA input").last().val($(this).parent().attr('data-id'));
          $(this).parent().remove();
        });
      }).catch(err => {alert(err.message);});
    });
  });
}

async function create_table(year, month) {
  await fetch('/api/book', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({year: year, month: month + 1})
  }).then(response => {
    if (!response.ok) {
      throw new Error (`${response.status}`);
    }
    return response.json();
  }).then(function(outcome) {
    booked = Array.from({length: 32}, () => []);
    outcome.forEach((x) => {
      booked[parseInt(x.date)].push(x);
    });
    for (let i = 1; i < booked.length; i++) {
      booked[i].sort(function(x, y) {return x.start < y.start ? -1 : 1});
      if (i === 10) console.log(booked[i]);
    }
    //console.log(booked);
  });
  $("#detail").html("");
  $("#cr-date").html(`<span style="padding: auto;">${month_name[month]} ${year}</span>`);
  let first_day = new Date(year, month, 1);
  let num_day = ((new Date(year, month + 1, 1)).getTime() - first_day.getTime()) / (1000*3600*24);
  let pos = first_day.getDay();
  let html = "<tr>" + "<th></th>\n".repeat(pos);
  for (let i = 1; i <= num_day; i++) {
    if (pos === 7) {
      html += "</tr>\n<tr>";
      pos = 0;
    }
    //html += `<th class="w-full h-full"><button type="button" onclick="malding(${i})" class="w-full h-full" ${(booked[i].length > 0) ?"style: border-color: red;":""}>${i}</button></th>`;
    html += `<th><div class="w-full h-full m-px text-center cursor-pointer" onclick="malding(${i})" ${(booked[i].length > 0) ?`style="border: 2px solid red;"`:""}>${i}</div></th>`;
    pos++;
  }
  $("#data-table-date").html(html + "<th></th>\n".repeat(7-pos) + "</tr>");
  $("#data-table-date div").css({"border-radius": "50%"});
}

onload = function() {
  let date = new Date();
  month = date.getMonth() ;
  year = date.getFullYear();
  create_table(year, month);
  $("#change-left").on('click', function() {
    if (month === 0) {
      month = 11;
      year--;
    }
    else {
      month--;
    }
    create_table(year, month);
  });
  $("#change-right").on('click', function() {
    if (month === 11) {
      month = 0;
      year++;
    }
    else {
      month++;
    }
    create_table(year, month);
  });
}