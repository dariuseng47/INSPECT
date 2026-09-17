// Tenant isolation wrapper — ดู docs/multi-tenant-isolation.md (ชั้นที่ 2)
// Controller ห้ามเรียก pool.query()/pool.execute() ตรงๆ กับตารางใน TENANT_SCOPED_TABLES
// ต้องผ่าน scopedQuery(pool, tenantId) เสมอ เพื่อบังคับ inject hospital_id เข้า WHERE ทุกครั้ง

export const TENANT_SCOPED_TABLES = new Set([
  'fabric_items',
  'fabric_lots',
  'fabric_categories',
  'devices',
  'scan_logs',
  'cabinets',
  'departments',
  'users',
  'ward_issue_rounds',
  'wash_receive_batches',
  'stock_scan_rounds',
  'audit_logs',
  'sync_conflicts',
  'registration_scan_sessions',
]);

// ตารางที่ tenant-scope แบบ "ทางอ้อม" ผ่าน FK เท่านั้น (ไม่มีคอลัมน์ hospital_id ของตัวเอง)
// ห้ามใส่ใน TENANT_SCOPED_TABLES เด็ดขาด (INSERT ผ่าน scopedQuery จะพยายามยัด hospital_id
// เข้าคอลัมน์ที่ไม่มีจริงแล้ว SQL error ทันที) — controller ต้องเช็คว่า parent record
// (เช่น fabric_items.hospital_id, cabinets.hospital_id) เป็นของ tenant ก่อนเขียนเองแทน
// ตารางกลุ่มนี้: hold_decommission_records (ผ่าน fabric_item_id), cabinet_par_levels (ผ่าน cabinet_id)

function assertTenantId(table, tenantId) {
  if (TENANT_SCOPED_TABLES.has(table) && (tenantId === undefined || tenantId === null)) {
    throw new Error(
      `scopedQuery: table "${table}" ถูก whitelist เป็น tenant-scoped แต่ไม่มี tenantId — ห้าม query ตารางนี้แบบไม่ระบุ tenant`
    );
  }
}

// รองรับ value เป็น null -> แปลเป็น "IS NULL" (เทียบเท่า MySQL) แทน "= ?" ซึ่งไม่มีทางเป็นจริง
function buildWhereClause(conditions) {
  const keys = Object.keys(conditions);
  const clauseParts = [];
  const values = [];

  keys.forEach((key) => {
    if (conditions[key] === null) {
      clauseParts.push(`\`${key}\` IS NULL`);
    } else {
      clauseParts.push(`\`${key}\` = ?`);
      values.push(conditions[key]);
    }
  });

  return {
    clause: clauseParts.length ? `WHERE ${clauseParts.join(' AND ')}` : '',
    values,
  };
}

export function scopedQuery(pool, tenantId) {
  return {
    /** SELECT ... WHERE hospital_id = tenantId AND ...where */
    async select(table, where = {}, { columns = '*' } = {}) {
      assertTenantId(table, tenantId);

      const conditions = TENANT_SCOPED_TABLES.has(table)
        ? { ...where, hospital_id: tenantId }
        : { ...where };

      const { clause, values } = buildWhereClause(conditions);

      const [rows] = await pool.query(`SELECT ${columns} FROM \`${table}\` ${clause}`, values);
      return rows;
    },

    /** INSERT พร้อมบังคับ hospital_id = tenantId เข้า payload อัตโนมัติ */
    async insert(table, data) {
      assertTenantId(table, tenantId);

      const payload = TENANT_SCOPED_TABLES.has(table) ? { ...data, hospital_id: tenantId } : data;
      const keys = Object.keys(payload);
      const placeholders = keys.map(() => '?').join(', ');

      const [result] = await pool.query(
        `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES (${placeholders})`,
        keys.map((key) => payload[key])
      );
      return result;
    },

    /** UPDATE ... WHERE hospital_id = tenantId AND ...where — กัน update ข้าม tenant */
    async update(table, where, data) {
      assertTenantId(table, tenantId);

      const conditions = TENANT_SCOPED_TABLES.has(table)
        ? { ...where, hospital_id: tenantId }
        : { ...where };

      const setKeys = Object.keys(data);
      const { clause: whereClause, values: whereValues } = buildWhereClause(conditions);
      if (!whereClause) {
        throw new Error('scopedQuery.update: ต้องมี WHERE condition เสมอ ห้าม update ทั้งตาราง');
      }

      const setClause = setKeys.map((key) => `\`${key}\` = ?`).join(', ');

      const [result] = await pool.query(
        `UPDATE \`${table}\` SET ${setClause} ${whereClause}`,
        [...setKeys.map((key) => data[key]), ...whereValues]
      );
      return result;
    },
  };
}
