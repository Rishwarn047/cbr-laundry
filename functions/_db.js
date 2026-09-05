function rowToRecord(row) {
  return {
    id: row.id,
    villaNumber: row.villa_number,
    staffName: row.staff_name,
    notes: row.notes,
    urgent: !!row.urgent,
    status: row.status,
    createdAt: row.created_at,
    doneAt: row.done_at,
    collectedBy: row.collected_by,
    collectedNotes: row.collected_notes,
    collectedAt: row.collected_at
  };
}

const SELECT_COLUMNS = `
  id, villa_number, staff_name, notes, urgent, status,
  created_at, done_at, collected_by, collected_notes, collected_at
`;

export async function listRequests(env, { status, villaNumber } = {}) {
  let query = `SELECT ${SELECT_COLUMNS} FROM requests`;
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (villaNumber) {
    conditions.push("villa_number = ?");
    params.push(villaNumber);
  }
  if (conditions.length) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  query += ` ORDER BY urgent DESC, created_at ASC`;

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(rowToRecord);
}

export async function getRequest(env, id) {
  const row = await env.DB.prepare(`SELECT ${SELECT_COLUMNS} FROM requests WHERE id = ?`).bind(id).first();
  return row ? rowToRecord(row) : null;
}

export async function insertRequest(env, data) {
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO requests (id, villa_number, staff_name, notes, urgent, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'Pending', ?)
  `).bind(
    id,
    data.villaNumber,
    data.staffName,
    data.notes || null,
    data.urgent ? 1 : 0,
    new Date().toISOString()
  ).run();
  return getRequest(env, id);
}

export async function markDone(env, id) {
  const row = await env.DB.prepare(`SELECT status FROM requests WHERE id = ?`).bind(id).first();
  if (!row) return { error: "not_found" };
  if (row.status !== "Pending") return { error: "invalid_state" };

  await env.DB.prepare(`UPDATE requests SET status = 'Done', done_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), id).run();
  return { record: await getRequest(env, id) };
}

export async function markPending(env, id) {
  const row = await env.DB.prepare(`SELECT status FROM requests WHERE id = ?`).bind(id).first();
  if (!row) return { error: "not_found" };
  if (row.status !== "Done") return { error: "invalid_state" };

  await env.DB.prepare(`UPDATE requests SET status = 'Pending', done_at = NULL WHERE id = ?`)
    .bind(id).run();
  return { record: await getRequest(env, id) };
}

export async function markCollected(env, id, { collectedBy, collectedNotes }) {
  const row = await env.DB.prepare(`SELECT status FROM requests WHERE id = ?`).bind(id).first();
  if (!row) return { error: "not_found" };
  if (row.status !== "Done") return { error: "invalid_state" };

  await env.DB.prepare(`
    UPDATE requests SET status = 'Collected', collected_by = ?, collected_notes = ?, collected_at = ?
    WHERE id = ?
  `).bind(collectedBy, collectedNotes || null, new Date().toISOString(), id).run();
  return { record: await getRequest(env, id) };
}
