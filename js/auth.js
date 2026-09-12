const Auth = {
  user: null,
  async init() {
    const saved = localStorage.getItem('cctv_user');
    if (saved) { try { this.user = JSON.parse(saved); } catch {} }
    if (supabaseClient) {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        this.user = { id: session.user.id, email: session.user.email, name: session.user.user_metadata?.full_name || session.user.email, provider: session.user.app_metadata?.provider || 'email' };
        localStorage.setItem('cctv_user', JSON.stringify(this.user));
      }
      supabaseClient.auth.onAuthStateChange((_e, session) => {
        if (session?.user) {
          this.user = { id: session.user.id, email: session.user.email, name: session.user.user_metadata?.full_name || session.user.email, provider: session.user.app_metadata?.provider || 'email' };
          localStorage.setItem('cctv_user', JSON.stringify(this.user));
          App.showApp();
        } else if (_e === 'SIGNED_OUT') {
          this.user = null;
          localStorage.removeItem('cctv_user');
          App.showAuth();
        }
      });
    }
    return this.user;
  },
  async login(email, password) {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      this.user = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.full_name || data.user.email, provider: 'email' };
    } else {
      const users = JSON.parse(localStorage.getItem('cctv_users') || '{}');
      if (!users[email] || users[email].password !== password) throw new Error('Email o contraseña incorrectos');
      this.user = { id: users[email].id, email, name: users[email].name || email, provider: 'local' };
    }
    localStorage.setItem('cctv_user', JSON.stringify(this.user));
    return this.user;
  },
  async register(email, password) {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      this.user = { id: data.user.id, email: data.user.email, name: email, provider: 'email' };
    } else {
      const users = JSON.parse(localStorage.getItem('cctv_users') || '{}');
      if (users[email]) throw new Error('Este email ya está registrado');
      const id = 'local_' + Date.now();
      users[email] = { id, password, name: email };
      localStorage.setItem('cctv_users', JSON.stringify(users));
      this.user = { id, email, name: email, provider: 'local' };
    }
    localStorage.setItem('cctv_user', JSON.stringify(this.user));
    return this.user;
  },
  async loginGoogle() {
    if (supabaseClient && CONFIG.GOOGLE_CLIENT_ID) {
      const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw new Error(error.message);
      return;
    }
    this.user = { id: 'google_demo_' + Date.now(), email: 'tecnico@demo.com', name: 'Técnico Demo', provider: 'google-demo' };
    localStorage.setItem('cctv_user', JSON.stringify(this.user));
    return this.user;
  },
  async logout() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    this.user = null;
    localStorage.removeItem('cctv_user');
  },
  isLoggedIn() { return !!this.user; }
};
