const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database Setup ──────────────────────────────────────────────
const DB_PATH = process.env.DATABASE_PATH || (fs.existsSync('/data') ? '/data/tipovacka.db' : path.join(__dirname, 'tipovacka.db'));
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    meno TEXT NOT NULL,
    priezvisko TEXT NOT NULL,
    datum_narodenia TEXT NOT NULL,
    trieda TEXT NOT NULL,
    skupina INTEGER DEFAULT 1,
    body INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0,
    avatar_color TEXT DEFAULT '#7c3aed',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS predmety (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nazov TEXT UNIQUE NOT NULL,
    ucitel TEXT DEFAULT '',
    has_groups INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pisomky (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    predmet_id INTEGER NOT NULL,
    trieda TEXT NOT NULL,
    skupina INTEGER DEFAULT 0,
    nazov TEXT NOT NULL,
    datum TEXT NOT NULL,
    popis TEXT DEFAULT '',
    stav TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (predmet_id) REFERENCES predmety(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pisomka_vysledky (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pisomka_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    nahlasena_znamka INTEGER CHECK(nahlasena_znamka BETWEEN 1 AND 5),
    nahlasena_at TEXT,
    skutocna_znamka INTEGER CHECK(skutocna_znamka BETWEEN 1 AND 5),
    potvrdene INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pisomka_id) REFERENCES pisomky(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(pisomka_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS tipy_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pisomka_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    predpovedana_znamka INTEGER NOT NULL CHECK(predpovedana_znamka BETWEEN 1 AND 5),
    skutocna_znamka INTEGER CHECK(skutocna_znamka BETWEEN 1 AND 5),
    bodovane INTEGER DEFAULT 0,
    ziskane_body INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pisomka_id) REFERENCES pisomky(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(pisomka_id, user_id, target_user_id)
  );

  CREATE TABLE IF NOT EXISTS tickety (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    typ TEXT NOT NULL,
    pozadovana_trieda TEXT,
    pozadovana_skupina INTEGER,
    sprava TEXT NOT NULL,
    odpoved_admina TEXT DEFAULT '',
    stav TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS triedy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nazov TEXT UNIQUE NOT NULL
  );
`);

// Auto-seed triedy (1.A - 4.E) if empty
const triedyCount = db.prepare('SELECT COUNT(*) as c FROM triedy').get().c;
if (triedyCount === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO triedy (nazov) VALUES (?)');
  for (let r = 1; r <= 4; r++) {
    for (const l of ['A', 'B', 'C', 'D', 'E']) {
      ins.run(`${r}.${l}`);
    }
  }
}

// Auto-seed admin user if not exists
const adminUser = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
if (!adminUser) {
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (username, password_hash, meno, priezvisko, datum_narodenia, trieda, skupina, body, is_admin, avatar_color)
    VALUES ('admin', ?, 'Hlavný', 'Admin', '2000-01-01', 'Admin', 0, 999, 1, '#ec4899')
  `).run(adminHash);
}

// Auto-seed default predmety if empty
const predmetyCount = db.prepare('SELECT COUNT(*) as c FROM predmety').get().c;
if (predmetyCount === 0) {
  const insertPredmet = db.prepare('INSERT INTO predmety (nazov, ucitel, has_groups) VALUES (?, ?, ?)');
  const defaultPredmety = [
    ['Anglický jazyk', '', 1],
    ['Digitálne technológie', '', 1],
    ['Ekonomika', '', 1],
    ['Elektronika', '', 0],
    ['Informačné a databázové systémy', '', 1],
    ['Matematika', '', 0],
    ['Občianska náuka', '', 0],
    ['Operačné systémy', '', 1],
    ['Programovanie', '', 1],
    ['Programovanie mikropočítačov', '', 1],
    ['Sieťové a serverové technológie', '', 1],
    ['Slovenský jazyk a literatúra', '', 0],
    ['Spracovanie grafiky na PC', '', 1],
    ['Tvorba WWW stránok', '', 1]
  ];
  for (const p of defaultPredmety) {
    insertPredmet.run(p[0], p[1], p[2]);
  }
}

// Ensure teacher names are completely cleared
try {
  db.prepare("UPDATE predmety SET ucitel = ''").run();
} catch (e) {}

const avatarColors = ['#7c3aed', '#06b6d4', '#f43f5e', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#3b82f6'];

// ── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'tipovacka-skolsky-projekt-2024-tajny-kluc',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Nie ste prihlásený' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Nie ste prihlásený' });
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !user.is_admin) return res.status(403).json({ error: 'Nemáte administrátorské práva' });
  next();
}

// ── AUTH ROUTES ──────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, meno, priezvisko, datum_narodenia, trieda } = req.body;

    if (!username || !password || !meno || !priezvisko || !datum_narodenia || !trieda) {
      return res.status(400).json({ error: 'Vyplňte všetky polia' });
    }
    if (username.length < 3) return res.status(400).json({ error: 'Prezývka musí mať aspoň 3 znaky' });
    if (password.length < 4) return res.status(400).json({ error: 'Heslo musí mať aspoň 4 znaky' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Táto prezývka už existuje' });

    const hash = await bcrypt.hash(password, 10);
    const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const result = db.prepare(
      'INSERT INTO users (username, password_hash, meno, priezvisko, datum_narodenia, trieda, skupina, avatar_color) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    ).run(username, hash, meno, priezvisko, datum_narodenia, trieda, color);

    req.session.userId = result.lastInsertRowid;
    res.json({ success: true, message: 'Registrácia úspešná! Vitajte 🎉' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Chyba servera pri registrácii' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Vyplňte všetky polia' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Nesprávna prezývka alebo heslo' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Nesprávna prezývka alebo heslo' });

    req.session.userId = user.id;
    res.json({ success: true, message: 'Prihlásenie úspešné!' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Chyba servera' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, meno, priezvisko, datum_narodenia, trieda, skupina, body, is_admin, avatar_color, created_at FROM users WHERE id = ?'
  ).get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'Používateľ neexistuje' });
  res.json(user);
});

// ── PREDMETY (SUBJECTS) ──────────────────────────────────────────

app.get('/api/predmety', requireAuth, (req, res) => {
  const predmety = db.prepare('SELECT id, nazov, "" AS ucitel, has_groups FROM predmety ORDER BY nazov').all();
  res.json(predmety);
});

// Get subjects with EduPage style grades & písomky
app.get('/api/predmety/edupage', requireAuth, (req, res) => {
  const currentUser = db.prepare('SELECT trieda, skupina, is_admin FROM users WHERE id = ?').get(req.session.userId);

  const predmety = db.prepare('SELECT id, nazov, "" AS ucitel, has_groups FROM predmety ORDER BY nazov').all();

  const result = predmety.map(p => {
    // For admin show all pisomky or filtered; for students show their class
    let pisomkyQuery = `
      SELECT p.*,
        (SELECT COUNT(*) FROM tipy_v2 WHERE pisomka_id = p.id) AS pocet_tipov,
        (SELECT COUNT(*) FROM tipy_v2 WHERE pisomka_id = p.id AND user_id = ?) AS moje_tipy_count
      FROM pisomky p
      WHERE p.predmet_id = ?
    `;
    const params = [req.session.userId, p.id];

    if (!currentUser.is_admin) {
      pisomkyQuery += ' AND p.trieda = ?';
      params.push(currentUser.trieda);
    } else if (req.query.trieda) {
      pisomkyQuery += ' AND p.trieda = ?';
      params.push(req.query.trieda);
    }

    pisomkyQuery += ' ORDER BY p.datum DESC, p.created_at DESC';
    const pisomky = db.prepare(pisomkyQuery).all(...params);

    // Recent results / grades badge summary
    const znamky = db.prepare(`
      SELECT pv.skutocna_znamka, p.nazov AS pisomka_nazov
      FROM pisomka_vysledky pv
      JOIN pisomky p ON pv.pisomka_id = p.id
      WHERE p.predmet_id = ? AND pv.student_id = ?
      ORDER BY p.datum DESC LIMIT 5
    `).all(p.id, req.session.userId);

    return {
      ...p,
      pisomky,
      znamky
    };
  });

  res.json(result);
});

// Admin: Get all pisomky directly
app.get('/api/admin/pisomky', requireAdmin, (req, res) => {
  const pisomky = db.prepare(`
    SELECT p.*, pr.nazov AS predmet_nazov,
      (SELECT COUNT(*) FROM tipy_v2 WHERE pisomka_id = p.id) AS pocet_tipov,
      (SELECT COUNT(*) FROM pisomka_vysledky WHERE pisomka_id = p.id AND nahlasena_znamka IS NOT NULL) AS pocet_nahlasenych,
      (SELECT COUNT(*) FROM users u WHERE u.is_admin = 0 AND u.trieda = p.trieda AND (p.skupina = 0 OR u.skupina = p.skupina)) AS pocet_ziakov
    FROM pisomky p
    JOIN predmety pr ON p.predmet_id = pr.id
    ORDER BY p.datum DESC, p.created_at DESC
  `).all();
  res.json(pisomky);
});

// Admin Predmety CRUD
app.post('/api/admin/predmety', requireAdmin, (req, res) => {
  const { nazov, ucitel, has_groups } = req.body;
  if (!nazov || !nazov.trim()) return res.status(400).json({ error: 'Názov predmetu je povinný' });

  try {
    const info = db.prepare('INSERT INTO predmety (nazov, ucitel, has_groups) VALUES (?, ?, ?)')
      .run(nazov.trim(), ucitel ? ucitel.trim() : '', has_groups ? 1 : 0);
    res.json({ success: true, id: info.lastInsertRowid, message: 'Predmet bol vytvorený' });
  } catch (e) {
    res.status(400).json({ error: 'Predmet s týmto názvom už existuje' });
  }
});

app.put('/api/admin/predmety/:id', requireAdmin, (req, res) => {
  const { nazov, ucitel, has_groups } = req.body;
  if (!nazov || !nazov.trim()) return res.status(400).json({ error: 'Názov predmetu je povinný' });

  try {
    db.prepare('UPDATE predmety SET nazov = ?, ucitel = ?, has_groups = ? WHERE id = ?')
      .run(nazov.trim(), ucitel ? ucitel.trim() : '', has_groups ? 1 : 0, req.params.id);
    res.json({ success: true, message: 'Predmet bol upravený' });
  } catch (e) {
    res.status(400).json({ error: 'Chyba pri úprave predmetu' });
  }
});

app.delete('/api/admin/predmety/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM predmety WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Predmet bol zmazaný' });
  } catch (e) {
    res.status(400).json({ error: 'Chyba pri mazaní predmetu' });
  }
});

// ── PÍSOMKY (TESTS / EVENTS) ─────────────────────────────────────

// Get single písomka with students list to tip on
app.get('/api/pisomky/:id', requireAuth, (req, res) => {
  const pisomka = db.prepare(`
    SELECT p.*, pr.nazov AS predmet_nazov, pr.ucitel AS predmet_ucitel, pr.has_groups
    FROM pisomky p
    JOIN predmety pr ON p.predmet_id = pr.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!pisomka) return res.status(404).json({ error: 'Písomka neexistuje' });

  // Eligible students in this class & group (exclude admin)
  let studentQuery = `
    SELECT u.id, u.meno, u.priezvisko, u.avatar_color, u.skupina, u.trieda
    FROM users u
    WHERE u.is_admin = 0 AND u.trieda = ?
  `;
  const params = [pisomka.trieda];

  if (pisomka.skupina === 1 || pisomka.skupina === 2) {
    studentQuery += ' AND u.skupina = ?';
    params.push(pisomka.skupina);
  }
  studentQuery += ' ORDER BY u.priezvisko, u.meno';

  const students = db.prepare(studentQuery).all(...params);

  // Attach user's tips and actual results / reported results
  const studentsWithTips = students.map(s => {
    const tip = db.prepare(
      'SELECT predpovedana_znamka, ziskane_body FROM tipy_v2 WHERE pisomka_id = ? AND user_id = ? AND target_user_id = ?'
    ).get(pisomka.id, req.session.userId, s.id);

    const vysledok = db.prepare(
      'SELECT nahlasena_znamka, nahlasena_at, skutocna_znamka, potvrdene FROM pisomka_vysledky WHERE pisomka_id = ? AND student_id = ?'
    ).get(pisomka.id, s.id);

    return {
      ...s,
      is_self: s.id === req.session.userId,
      moj_tip: tip ? tip.predpovedana_znamka : null,
      ziskane_body: tip ? tip.ziskane_body : null,
      nahlasena_znamka: vysledok ? vysledok.nahlasena_znamka : null,
      nahlasena_at: vysledok ? vysledok.nahlasena_at : null,
      skutocna_znamka: vysledok ? vysledok.skutocna_znamka : null,
      potvrdene: vysledok ? vysledok.potvrdene : 0
    };
  });

  const currentUserGrade = db.prepare(
    'SELECT nahlasena_znamka, skutocna_znamka, potvrdene FROM pisomka_vysledky WHERE pisomka_id = ? AND student_id = ?'
  ).get(pisomka.id, req.session.userId);

  const is_student = students.some(s => s.id === req.session.userId);
  const pocet_nahlasenych = db.prepare(
    'SELECT COUNT(*) AS c FROM pisomka_vysledky WHERE pisomka_id = ? AND nahlasena_znamka IS NOT NULL'
  ).get(pisomka.id).c;

  res.json({
    pisomka: {
      ...pisomka,
      pocet_nahlasenych,
      pocet_ziakov: students.length
    },
    students: studentsWithTips,
    is_student,
    moja_nahlasena_znamka: currentUserGrade ? currentUserGrade.nahlasena_znamka : null,
    moja_skutocna_znamka: currentUserGrade ? currentUserGrade.skutocna_znamka : null,
    moje_potvrdene: currentUserGrade ? currentUserGrade.potvrdene : 0
  });
});

// Student: Self-report their grade for this test
app.post('/api/pisomky/:id/nahlasit-znamku', requireAuth, (req, res) => {
  const pisomkaId = req.params.id;
  const { znamka } = req.body;
  const parsedZnamka = parseInt(znamka);

  if (!parsedZnamka || parsedZnamka < 1 || parsedZnamka > 5) {
    return res.status(400).json({ error: 'Známka musí byť číslo od 1 do 5' });
  }

  const pisomka = db.prepare('SELECT * FROM pisomky WHERE id = ?').get(pisomkaId);
  if (!pisomka) return res.status(404).json({ error: 'Písomka neexistuje' });
  if (pisomka.stav !== 'active') {
    return res.status(400).json({ error: 'Táto písomka už bola vyhodnotená, známku nie je možné zmeniť' });
  }

  const currentUser = db.prepare('SELECT id, trieda, skupina, is_admin FROM users WHERE id = ?').get(req.session.userId);
  if (currentUser.is_admin) {
    return res.status(400).json({ error: 'Administrátor si nenahlasuje žiacku známku' });
  }

  if (currentUser.trieda !== pisomka.trieda) {
    return res.status(403).json({ error: 'Táto písomka nie je pre tvoju triedu' });
  }
  if (pisomka.skupina > 0 && currentUser.skupina !== pisomka.skupina) {
    return res.status(403).json({ error: 'Táto písomka je pre inú skupinu' });
  }

  try {
    db.prepare(`
      INSERT INTO pisomka_vysledky (pisomka_id, student_id, nahlasena_znamka, nahlasena_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(pisomka_id, student_id)
      DO UPDATE SET nahlasena_znamka = excluded.nahlasena_znamka, nahlasena_at = datetime('now')
    `).run(pisomkaId, req.session.userId, parsedZnamka);

    res.json({
      success: true,
      message: `Známka ${parsedZnamka} bola úspešne nahlásená! Administrátor ju overí a potvrdí. 👍`,
      nahlasena_znamka: parsedZnamka
    });
  } catch (e) {
    console.error('Error reporting grade:', e);
    res.status(500).json({ error: 'Chyba pri ukladaní známky' });
  }
});

// Tip on student for a pisomka
app.post('/api/tipy/pisomka', requireAuth, (req, res) => {
  const { pisomka_id, target_user_id, predpovedana_znamka } = req.body;

  if (!pisomka_id || !target_user_id || !predpovedana_znamka) {
    return res.status(400).json({ error: 'Chýbajúce údaje' });
  }

  if (Number(target_user_id) === req.session.userId) {
    return res.status(400).json({ error: 'Nemôžeš tipovať sám na seba!' });
  }

  const pisomka = db.prepare('SELECT stav FROM pisomky WHERE id = ?').get(pisomka_id);
  if (!pisomka) return res.status(404).json({ error: 'Písomka neexistuje' });
  if (pisomka.stav !== 'active') return res.status(400).json({ error: 'Tipovanie na túto písomku je už ukončené' });

  try {
    db.prepare(`
      INSERT INTO tipy_v2 (pisomka_id, user_id, target_user_id, predpovedana_znamka)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(pisomka_id, user_id, target_user_id)
      DO UPDATE SET predpovedana_znamka = excluded.predpovedana_znamka
    `).run(pisomka_id, req.session.userId, target_user_id, predpovedana_znamka);

    res.json({ success: true, message: 'Tip bol zaznamenaný! 🎯' });
  } catch (e) {
    console.error('Tip error:', e);
    res.status(500).json({ error: 'Chyba pri ukladaní tipu' });
  }
});

// Admin: Create pisomka
app.post('/api/admin/pisomky', requireAdmin, (req, res) => {
  const { predmet_id, trieda, skupina, nazov, datum, popis } = req.body;

  if (!predmet_id || !trieda || !nazov || !datum) {
    return res.status(400).json({ error: 'Vyplňte predmet, triedu, názov a dátum' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO pisomky (predmet_id, trieda, skupina, nazov, datum, popis, stav)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(predmet_id, trieda, Number(skupina) || 0, nazov.trim(), datum, popis || '');

    res.json({ success: true, id: result.lastInsertRowid, message: 'Písomka bola úspešne vytvorená! 📝' });
  } catch (e) {
    console.error('Create pisomka error:', e);
    res.status(500).json({ error: 'Chyba pri vytváraní písomky' });
  }
});

// Admin: Delete pisomka
app.delete('/api/admin/pisomky/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM pisomky WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Písomka bola zmazaná' });
  } catch (e) {
    res.status(500).json({ error: 'Chyba pri mazaní písomky' });
  }
});

// Admin: Vyhodnotiť písomku (zadať známky žiakov)
app.post('/api/admin/pisomky/:id/vyhodnotit', requireAdmin, (req, res) => {
  const pisomkaId = req.params.id;
  const { vysledky } = req.body; // array of { student_id, znamka }

  if (!vysledky || !Array.isArray(vysledky) || vysledky.length === 0) {
    return res.status(400).json({ error: 'Zadajte známky pre žiakov' });
  }

  const pisomka = db.prepare('SELECT * FROM pisomky WHERE id = ?').get(pisomkaId);
  if (!pisomka) return res.status(404).json({ error: 'Písomka neexistuje' });

  const executeResolution = db.transaction(() => {
    // 1. Insert or update actual grades and mark as confirmed
    const insGrade = db.prepare(`
      INSERT INTO pisomka_vysledky (pisomka_id, student_id, skutocna_znamka, potvrdene)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(pisomka_id, student_id)
      DO UPDATE SET skutocna_znamka = excluded.skutocna_znamka, potvrdene = 1
    `);

    for (const v of vysledky) {
      if (v.znamka >= 1 && v.znamka <= 5) {
        insGrade.run(pisomkaId, v.student_id, v.znamka);
      }
    }

    // 2. Mark pisomka as resolved
    db.prepare("UPDATE pisomky SET stav = 'resolved' WHERE id = ?").run(pisomkaId);

    // 3. Score all tips for this pisomka
    const tips = db.prepare('SELECT * FROM tipy_v2 WHERE pisomka_id = ?').all(pisomkaId);
    let totalPointsAwarded = 0;

    for (const tip of tips) {
      const actual = db.prepare(
        'SELECT skutocna_znamka FROM pisomka_vysledky WHERE pisomka_id = ? AND student_id = ?'
      ).get(pisomkaId, tip.target_user_id);

      if (actual) {
        let pts = 0;
        if (tip.predpovedana_znamka === actual.skutocna_znamka) {
          pts = 3;
        } else if (Math.abs(tip.predpovedana_znamka - actual.skutocna_znamka) === 1) {
          pts = 1;
        }

        db.prepare(`
          UPDATE tipy_v2
          SET skutocna_znamka = ?, bodovane = 1, ziskane_body = ?
          WHERE id = ?
        `).run(actual.skutocna_znamka, pts, tip.id);

        if (pts > 0) {
          db.prepare('UPDATE users SET body = body + ? WHERE id = ?').run(pts, tip.user_id);
          totalPointsAwarded += pts;
        }
      }
    }

    return { totalPointsAwarded, tipsEvaluated: tips.length };
  });

  try {
    const outcome = executeResolution();
    res.json({
      success: true,
      message: `Písomka vyhodnotená! Vyhodnotených tipov: ${outcome.tipsEvaluated}, rozdaných bodov: ${outcome.totalPointsAwarded} ⭐`
    });
  } catch (e) {
    console.error('Vyhodnotenie error:', e);
    res.status(500).json({ error: 'Chyba pri vyhodnocovaní písomky' });
  }
});

// ── TRIEDY & SKUPINY (ADMIN) ─────────────────────────────────────

// Get all school classes (1.A - 4.E)
app.get('/api/triedy', requireAuth, (req, res) => {
  const triedy = db.prepare('SELECT id, nazov FROM triedy ORDER BY id').all();
  res.json(triedy);
});

// Get users grouped by class and then by group (1 and 2)
app.get('/api/admin/users/by-class', requireAdmin, (req, res) => {
  try {
    let allTriedy = [];
    try {
      allTriedy = db.prepare('SELECT nazov FROM triedy ORDER BY id').all();
    } catch (e) {
      // fallback
    }

    const classesMap = {};
    if (allTriedy.length > 0) {
      for (const t of allTriedy) {
        classesMap[t.nazov] = { skupina1: [], skupina2: [] };
      }
    } else {
      for (let r = 1; r <= 4; r++) {
        for (const l of ['A', 'B', 'C', 'D', 'E']) {
          classesMap[`${r}.${l}`] = { skupina1: [], skupina2: [] };
        }
      }
    }

    const users = db.prepare(`
      SELECT id, username, meno, priezvisko, datum_narodenia, trieda, skupina, body, is_admin, avatar_color, created_at,
        (SELECT COUNT(*) FROM tipy_v2 WHERE user_id = users.id) AS pocet_tipov
      FROM users
      WHERE trieda != 'Admin'
      ORDER BY trieda, skupina, priezvisko, meno
    `).all();

    // Group users into their respective classes
    for (const u of users) {
      const cls = u.trieda;
      if (!classesMap[cls]) {
        classesMap[cls] = { skupina1: [], skupina2: [] };
      }
      if (u.skupina === 2) {
        classesMap[cls].skupina2.push(u);
      } else {
        classesMap[cls].skupina1.push(u);
      }
    }

    res.json(classesMap);
  } catch (err) {
    console.error('Error in by-class:', err);
    res.status(500).json({ error: 'Chyba servera pri načítavaní tried' });
  }
});

// Update user group (1 or 2)
app.put('/api/admin/users/:id/skupina', requireAdmin, (req, res) => {
  const { skupina } = req.body;
  const grp = Number(skupina) === 2 ? 2 : 1;
  db.prepare('UPDATE users SET skupina = ? WHERE id = ?').run(grp, req.params.id);
  res.json({ success: true, message: `Žiak presunutý do Skupiny ${grp}` });
});

// Toggle admin
app.put('/api/admin/users/:id/admin', requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.session.userId) {
    return res.status(400).json({ error: 'Nemôžete zmeniť svoj vlastný admin status' });
  }

  const target = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Používateľ neexistuje' });

  const newStatus = target.is_admin ? 0 : 1;
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(newStatus, targetId);
  res.json({ success: true, message: newStatus ? 'Admin práva udelené' : 'Admin práva odobraté' });
});

// Delete user
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.session.userId) return res.status(400).json({ error: 'Nemôžete zmazať sami seba' });

  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM tipy_v2 WHERE user_id = ? OR target_user_id = ?').run(targetId, targetId);
      db.prepare('DELETE FROM pisomka_vysledky WHERE student_id = ?').run(targetId);
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    });
    tx();
    res.json({ success: true, message: 'Používateľ bol úspešne zmazaný' });
  } catch (e) {
    console.error('Delete user error:', e);
    res.status(500).json({ error: 'Chyba pri mazaní používateľa' });
  }
});

// ── LEADERBOARD & MY TIPS ────────────────────────────────────────

app.get('/api/rebricek', requireAuth, (req, res) => {
  const rebricek = db.prepare(`
    SELECT id, username, meno, priezvisko, trieda, skupina, body, avatar_color,
      (SELECT COUNT(*) FROM tipy_v2 WHERE user_id = users.id) AS pocet_tipov,
      (SELECT COUNT(*) FROM tipy_v2 WHERE user_id = users.id AND bodovane = 1 AND predpovedana_znamka = skutocna_znamka) AS spravne_tipy
    FROM users
    WHERE is_admin = 0
    ORDER BY body DESC, meno ASC
    LIMIT 50
  `).all();
  res.json(rebricek);
});

app.get('/api/tipy/moje', requireAuth, (req, res) => {
  const tipy = db.prepare(`
    SELECT t.*,
      p.nazov AS pisomka_nazov, p.datum AS pisomka_datum, p.stav AS pisomka_stav,
      pr.nazov AS predmet_nazov,
      u.meno AS target_meno, u.priezvisko AS target_priezvisko, u.trieda AS target_trieda, u.avatar_color AS target_avatar_color
    FROM tipy_v2 t
    JOIN pisomky p ON t.pisomka_id = p.id
    JOIN predmety pr ON p.predmet_id = pr.id
    JOIN users u ON t.target_user_id = u.id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
  `).all(req.session.userId);
  res.json(tipy);
});

app.get('/api/stats', requireAuth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const totalPisomky = db.prepare('SELECT COUNT(*) AS c FROM pisomky').get().c;
  const myTipy = db.prepare('SELECT COUNT(*) AS c FROM tipy_v2 WHERE user_id = ?').get(req.session.userId).c;
  const myCorrect = db.prepare(
    'SELECT COUNT(*) AS c FROM tipy_v2 WHERE user_id = ? AND bodovane = 1 AND predpovedana_znamka = skutocna_znamka'
  ).get(req.session.userId).c;
  const user = db.prepare('SELECT body FROM users WHERE id = ?').get(req.session.userId);

  res.json({
    totalUsers,
    totalPisomky,
    myTipy,
    myCorrect,
    myPoints: user ? user.body : 0
  });
});

// ── TICKET SYSTÉM (ŽIADOSTI O ZMENU TRIEDY A SKUPINY) ───────────

// Žiak: odoslanie žiadosti / ticketu
app.post('/api/tickety', requireAuth, (req, res) => {
  const { typ, pozadovana_trieda, pozadovana_skupina, sprava } = req.body;

  if (!typ || !sprava || !sprava.trim()) {
    return res.status(400).json({ error: 'Zadajte dôvod alebo správu k žiadosti' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO tickety (user_id, typ, pozadovana_trieda, pozadovana_skupina, sprava, stav)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(
      req.session.userId,
      typ,
      pozadovana_trieda || null,
      pozadovana_skupina ? parseInt(pozadovana_skupina) : null,
      sprava.trim()
    );

    res.json({ success: true, id: result.lastInsertRowid, message: 'Žiadosť bola odoslaná administrátorovi! 🎫' });
  } catch (e) {
    console.error('Ticket error:', e);
    res.status(500).json({ error: 'Chyba pri vytváraní ticketu' });
  }
});

// Žiak: získanie mojich ticketov
app.get('/api/tickety/moje', requireAuth, (req, res) => {
  const tickety = db.prepare(`
    SELECT * FROM tickety WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.session.userId);
  res.json(tickety);
});

// Admin: získanie všetkých ticketov
app.get('/api/admin/tickety', requireAdmin, (req, res) => {
  const tickety = db.prepare(`
    SELECT t.*, u.meno, u.priezvisko, u.username, u.trieda AS aktualna_trieda, u.skupina AS aktualna_skupina, u.avatar_color
    FROM tickety t
    JOIN users u ON t.user_id = u.id
    ORDER BY CASE WHEN t.stav = 'pending' THEN 0 ELSE 1 END, t.created_at DESC
  `).all();
  res.json(tickety);
});

// Admin: Schválenie žiadosti a automatické vykonanie zmeny
app.put('/api/admin/tickety/:id/approve', requireAdmin, (req, res) => {
  const ticketId = parseInt(req.params.id);
  const ticket = db.prepare('SELECT * FROM tickety WHERE id = ?').get(ticketId);

  if (!ticket) return res.status(404).json({ error: 'Ticket neexistuje' });
  if (ticket.stav !== 'pending') return res.status(400).json({ error: 'Tento ticket už bol vybavený' });

  const odpoved = (req.body && req.body.odpoved) ? req.body.odpoved.trim() : 'Žiadosť bola schválená a zmena vykonaná ✅';

  const executeApproval = db.transaction(() => {
    // 1. If changing class, update user's class
    if (ticket.pozadovana_trieda) {
      db.prepare('UPDATE users SET trieda = ? WHERE id = ?').run(ticket.pozadovana_trieda, ticket.user_id);
    }
    // 2. If changing group, update user's group
    if (ticket.pozadovana_skupina) {
      db.prepare('UPDATE users SET skupina = ? WHERE id = ?').run(ticket.pozadovana_skupina, ticket.user_id);
    }
    // 3. Mark ticket as approved
    db.prepare(`
      UPDATE tickety
      SET stav = 'approved', odpoved_admina = ?, resolved_at = datetime('now')
      WHERE id = ?
    `).run(odpoved, ticketId);
  });

  try {
    executeApproval();
    res.json({ success: true, message: 'Žiadosť bola schválená a žiak bol presunutý! 🎉' });
  } catch (e) {
    console.error('Approve ticket error:', e);
    res.status(500).json({ error: 'Chyba pri schvaľovaní ticketu' });
  }
});

// Admin: Zamietnutie žiadosti
app.put('/api/admin/tickety/:id/reject', requireAdmin, (req, res) => {
  const ticketId = parseInt(req.params.id);
  const ticket = db.prepare('SELECT * FROM tickety WHERE id = ?').get(ticketId);

  if (!ticket) return res.status(404).json({ error: 'Ticket neexistuje' });
  if (ticket.stav !== 'pending') return res.status(400).json({ error: 'Tento ticket už bol vybavený' });

  const odpoved = (req.body && req.body.odpoved) ? req.body.odpoved.trim() : 'Žiadosť bola zamietnutá.';

  try {
    db.prepare(`
      UPDATE tickety
      SET stav = 'rejected', odpoved_admina = ?, resolved_at = datetime('now')
      WHERE id = ?
    `).run(odpoved, ticketId);
    res.json({ success: true, message: 'Žiadosť bola zamietnutá' });
  } catch (e) {
    console.error('Reject ticket error:', e);
    res.status(500).json({ error: 'Chyba pri zamietnutí ticketu' });
  }
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const totalPredmety = db.prepare('SELECT COUNT(*) AS c FROM predmety').get().c;
    const totalPisomky = db.prepare('SELECT COUNT(*) AS c FROM pisomky').get().c;
    const activePisomky = db.prepare("SELECT COUNT(*) AS c FROM pisomky WHERE stav = 'active'").get().c;
    const totalTipy = db.prepare('SELECT COUNT(*) AS c FROM tipy_v2').get().c;
    const pendingTickety = db.prepare("SELECT COUNT(*) AS c FROM tickety WHERE stav = 'pending'").get().c;

    res.json({ totalUsers, totalPredmety, totalPisomky, activePisomky, totalTipy, pendingTickety });
  } catch (err) {
    console.error('Error in /api/admin/stats:', err);
    res.status(500).json({ error: 'Chyba servera pri načítaní štatistík' });
  }
});

// Single page app fallback
app.get('/dashboard*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   🎓 EduTip - Školské tipovanie          ║');
  console.log(`  ║   🌐 http://localhost:${PORT}               ║`);
  console.log('  ║   📊 Databáza: tipovacka.db              ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
