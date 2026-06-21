// Credits Modal Show/Hide and Image Upload Handling
const openCreditsBtn = document.getElementById('openCreditsBtn');
const creditsModal = document.getElementById('creditsModal');
const closeCreditsModal = document.getElementById('closeCreditsModal');

if (openCreditsBtn && creditsModal) {
  openCreditsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    creditsModal.classList.add('open');
  });
}

if (closeCreditsModal && creditsModal) {
  closeCreditsModal.addEventListener('click', () => {
    creditsModal.classList.remove('open');
  });
}

if (creditsModal) {
  creditsModal.addEventListener('click', (e) => {
    if (e.target === creditsModal) creditsModal.classList.remove('open');
  });
}

// Connect hidden file inputs to dev avatars and handle uploads
for (let i = 0; i < 5; i++) {
  const avatarWrap = document.getElementById(`devAvatarWrap_${i}`);
  const fileInput = document.getElementById(`devInput_${i}`);
  const avatarImg = document.getElementById(`devAvatarImg_${i}`);
  const placeholder = document.getElementById(`devAvatarPlaceholder_${i}`);

  if (avatarWrap && fileInput) {
    avatarWrap.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('الحد الأقصى لحجم الصورة هو 2 ميجابايت.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        avatarImg.src = reader.result;
        avatarImg.style.display = 'block';
        placeholder.style.display = 'none';
        try {
          localStorage.setItem(`tabibak_dev_photo_${i}`, reader.result);
        } catch (err) {
          console.error("Failed to save dev photo in localStorage", err);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Pre-load saved developer photos from localStorage
  try {
    const savedPhoto = localStorage.getItem(`tabibak_dev_photo_${i}`);
    if (savedPhoto && avatarImg && placeholder) {
      avatarImg.src = savedPhoto;
      avatarImg.style.display = 'block';
      placeholder.style.display = 'none';
    }
  } catch (err) { }
}
