import { createClient } from '@libsql/client';
const c = createClient({
  url: 'libsql://tabibak-hashemelhelo2827.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE1Mzc4MDgsImlkIjoiMDE5ZWNiZWQtNjMwMS0zMmMzLTg3ODYtYWQ1ZGQyNDU0ZjUyIiwicmlkIjoiNmU0MzFmOTEtMzU2ZC00MTY5LWJmMzAtODBjOGQzMDE2NGFhIn0.Q4dKzfN-nSwM6oDgYqhKGVbEec2Yb1ju_44tguK5kb1ktUvhq1SSy8o4Ka6u8XHHE0QQo3AnSt3RHY6eCeEVDg'
});
const r = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
r.rows.forEach(row => console.log(row.name));
