function showNotificationModal() {
      document.getElementById('notificationModal').classList.add('open');
    }

    document.getElementById('notificationEnableBtn').addEventListener('click', requestNotifPermission);

    document.getElementById('notificationModalClose').addEventListener('click', () => {
      document.getElementById('notificationModal').classList.remove('open');
      refreshProfileScreen();
      showTab('profile');
    });

    document.getElementById('notificationModal').addEventListener('click', e => {
      if (e.target === document.getElementById('notificationModal')) {
        document.getElementById('notificationModal').classList.remove('open');
        refreshProfileScreen();
        showTab('profile');
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      STATE.currentUser = null;
      clearToken();
      STATE.sessions = [];
      STATE.meds.list = [];
      STATE.meds.taken = {};
      refreshProfileScreen();
      refreshHistoryScreen();
    });

    document.getElementById('editProfileBtn').addEventListener('click', () => {
      const u = STATE.currentUser;
      if (!u) return;
      document.getElementById('editName').value = u.name || '';
      document.getElementById('editAge').value = u.age || '';
      document.getElementById('editGender').value = u.gender || '';
      document.getElementById('editMobile').value = u.mobile || '';
      document.getElementById('editHistory').value = u.history || '';
      document.getElementById('editProfileForm').style.display = '';
    });

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      document.getElementById('editProfileForm').style.display = 'none';
    });

    document.getElementById('editProfileForm').addEventListener('submit', async e => {
      e.preventDefault();
      const u = STATE.currentUser;
      const nameVal = document.getElementById('editName').value.trim();
      const ageVal = document.getElementById('editAge').value;
      const genderVal = document.getElementById('editGender').value;
      const mobileVal = document.getElementById('editMobile').value.trim();
      const historyVal = document.getElementById('editHistory').value.trim();

      if (!nameVal || !ageVal || !genderVal || !mobileVal) {
        alert('يرجى ملء جميع الحقول المطلوبة.');
        return;
      }
      const ageNum = parseInt(ageVal, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) { alert('يرجى إدخال عمر صحيح يتراوح بين 1 و120 عاماً.'); return; }
      const mobileRegex = /^\+?[0-9]{10,15}$/;
      if (!mobileRegex.test(mobileVal)) {
        alert('يرجى إدخال رقم هاتف محمول صحيح (يتكون من 10 إلى 15 رقماً).');
        return;
      }

      try {
        await api('PUT', '/api/auth/profile', { name: nameVal, age: ageVal, gender: genderVal, mobile: mobileVal, history: historyVal, timezoneOffset: -new Date().getTimezoneOffset() / 60 });
        STATE.currentUser = await api('GET', '/api/auth/profile');
        document.getElementById('editProfileForm').style.display = 'none';
        refreshProfileScreen();
      } catch (err) {
        alert('فشل تحديث الملف الشخصي.');
      }
    });

    async function refreshProfileScreen() {
      const loggedIn = !!STATE.currentUser;
      document.getElementById('authContainer').style.display = loggedIn ? 'none' : '';
      document.getElementById('profileContainer').style.display = loggedIn ? '' : 'none';
      if (loggedIn) {
        const u = STATE.currentUser;
        document.getElementById('profileName').textContent = u.name || '';
        document.getElementById('profileUsername').textContent = u.username ? '@' + u.username : '';
        document.getElementById('profileAge').textContent = u.age || '';
        document.getElementById('profileGender').textContent = u.gender || '';
        document.getElementById('profileMobile').textContent = u.mobile || 'Not set';
        document.getElementById('profileHistory').textContent = u.history || 'No medical background declared.';
        if (u.avatar) {
          document.getElementById('profileAvatar').src = u.avatar;
          document.getElementById('profileAvatar').style.display = '';
          document.getElementById('avatarPlaceholder').style.display = 'none';
        } else {
          document.getElementById('profileAvatar').style.display = 'none';
          document.getElementById('avatarPlaceholder').style.display = '';
        }

        // Mentor section
        const mentorSection = document.getElementById('profileMentorSection');
        mentorSection.style.display = '';
        const mentorsList = document.getElementById('profileMentorsList');
        if (STATE.mentors.length === 0) {
          mentorsList.innerHTML = '<p style="color:var(--text-2);font-size:0.8rem;">لم تقم بإضافة أي مشرف بعد.</p>';
        } else {
          mentorsList.innerHTML = STATE.mentors.map(m => `
            <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.6rem;">
              <i class="ti ti-user-check" style="color:var(--primary);"></i>
              <span style="flex:1;font-size:0.85rem;">${m.name} <span style="color:var(--text-2);font-size:0.75rem;">@${m.mentorUsername}</span></span>
              <button class="profile-mentor-remove" data-user="${m.mentorUsername}" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.9rem;"><i class="ti ti-trash"></i></button>
            </div>
          `).join('');
          mentorsList.querySelectorAll('.profile-mentor-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
              if (!confirm('إزالة هذا المرشد؟')) return;
              try {
                await api('DELETE', `/api/mentors/${btn.dataset.user}`);
                await loadMentorData();
                refreshProfileScreen();
              } catch (e) { alert(e.message); }
            });
          });
        }
        const menteesWrap = document.getElementById('profileMenteesBtnWrap');
        menteesWrap.style.display = STATE.mentees.length > 0 ? '' : 'none';

        // Wire up add mentor button (re-bind on each refresh)
        document.getElementById('profileAddMentorBtn').onclick = async () => {
          const username = prompt('أدخل اسم المستخدم للمرشد:');
          if (!username) return;
          try {
            await api('POST', '/api/mentors', { mentorUsername: username.trim() });
            await loadMentorData();
            refreshProfileScreen();
          } catch (e) { alert(e.message); }
        };
        // Wire up mentees button
        document.getElementById('profileMenteesBtn').onclick = () => showTab('mentor');

        // Load mentor messages
        const msgWrap = document.getElementById('profileMentorMessagesWrap');
        const msgDiv = document.getElementById('profileMentorMessages');
        const replyWrap = document.getElementById('profileMentorReplyWrap');
        if (STATE.mentors.length > 0) {
          let msgs = [];
          try {
            msgs = await api('GET', '/api/mentors/messages');
            if (msgs && msgs.length > 0) {
              msgWrap.style.display = '';
              msgDiv.innerHTML = msgs.slice(0, 10).map(m => `
                <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.6rem;font-size:0.8rem;">
                  <strong style="color:var(--primary);font-size:0.75rem;">${m.mentorName}</strong>
                  <p style="margin:0.2rem 0;word-break:break-word;">${m.message}</p>
                  <span style="color:var(--text-2);font-size:0.65rem;">${new Date(m.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
              `).join('');
            } else {
              msgDiv.innerHTML = '<p style="color:var(--text-2);font-size:0.8rem;">لا توجد رسائل بعد.</p>';
            }
            replyWrap.style.display = '';
          } catch (e) { msgWrap.style.display = 'none'; replyWrap.style.display = 'none'; }

          // Populate mentor reply dropdown
          const sel = document.getElementById('profileMentorReplySelect');
          sel.innerHTML = STATE.mentors.map(m =>
            `<option value="${m.mentorUsername}">${m.name} (@${m.mentorUsername})</option>`
          ).join('');

          // Pre-select the most recent sender
          if (msgs && msgs.length > 0) {
            sel.value = msgs[0].mentorUsername;
          }

          // Wire up send
          document.getElementById('profileMentorReplySend').onclick = async () => {
            const input = document.getElementById('profileMentorReplyInput');
            const msg = input.value.trim();
            if (!msg) return;
            const mentorUser = document.getElementById('profileMentorReplySelect').value;
            input.value = '';
            try {
              await api('POST', '/api/mentors/reply', { mentorUsername: mentorUser, message: msg });
              refreshProfileScreen();
            } catch (e) { alert(e.message); }
          };
          document.getElementById('profileMentorReplyInput').onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('profileMentorReplySend').click();
          };
        } else {
          msgWrap.style.display = 'none';
          replyWrap.style.display = 'none';
        }
      }
    }

    /* ------ Profile photo upload ------ */
    document.getElementById('avatarWrap').addEventListener('click', () => {
      document.getElementById('avatarInput').click();
    });
    document.getElementById('avatarInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('الحد الأقصى لحجم الصورة 2 ميجابايت'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api('PUT', '/api/auth/avatar', { avatar: reader.result });
          STATE.currentUser = await api('GET', '/api/auth/profile');
          refreshProfileScreen();
        } catch (err) {
          alert('فشل رفع الصورة');
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
