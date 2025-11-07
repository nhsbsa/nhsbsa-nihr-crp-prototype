// app/assets/javascripts/prescreener/autocomplete-init.js
(function () {
  function attach(inputSel, hiddenSel, src) {
    var input = document.querySelector(inputSel);
    var hidden = document.querySelector(hiddenSel);
    if (!input || !hidden) return;

    fetch(src).then(r => r.json()).then(list => {
      var current = [];
      input.setAttribute('autocomplete', 'off');

      var box = document.createElement('div');
      box.className = 'nhsuk-u-padding-2 nhsuk-u-margin-top-1';
      box.style.border = '1px solid #b1b4b6';
      box.style.display = 'none';
      input.parentNode.appendChild(box);

      input.addEventListener('input', function () {
        var q = input.value.toLowerCase().trim();
        current = list.filter(item => item.name.toLowerCase().includes(q)).slice(0, 8);
        if (!q || current.length === 0) {
          box.style.display = 'none';
          return;
        }
        box.innerHTML = current.map((item, i) =>
          '<button type="button" data-i="' + i + '" class="nhsuk-button nhsuk-button--secondary" style="display:block;margin-bottom:6px;">' + item.name + '</button>'
        ).join('');
        box.style.display = 'block';
      });

      box.addEventListener('click', function (e) {
        if (e.target && e.target.matches('button[data-i]')) {
          var item = current[parseInt(e.target.getAttribute('data-i'), 10)];
          input.value = item.name;
          hidden.value = item.code;
          box.style.display = 'none';
          // mirror into hidden fields used by the add form
          var mirrorLabel = document.getElementById(input.id.replace('-search','') + '-hidden-label');
          var mirrorCode = document.getElementById(input.id.replace('-search','') + '-hidden-code');
          if (mirrorLabel) mirrorLabel.value = item.name;
          if (mirrorCode) mirrorCode.value = item.code;
        }
      });

      document.addEventListener('click', function (e) {
        if (!box.contains(e.target) && e.target !== input) box.style.display = 'none';
      });
    }).catch(function(){});
  }

  window.initAutocomplete = function (inputSel, hiddenSel, src) {
    attach(inputSel, hiddenSel, src);
  };
})();
