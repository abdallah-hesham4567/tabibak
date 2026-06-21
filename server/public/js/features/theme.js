document.getElementById('themeBtn').addEventListener('click', () => {
      STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
      document.body.classList.toggle('dark', STATE.theme === 'dark');
      document.getElementById('themeBtn').innerHTML = STATE.theme === 'dark'
        ? '<i class="ti ti-moon theme-icon moon"></i>'
        : '<i class="ti ti-sun theme-icon sun"></i>';
    });
