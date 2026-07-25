// cleanup_sajna_duplicates.ts
import { query } from '../src/config/db';

async function clean() {
  try {
    // Keep the earliest entry for vendor_id=3, category='shawl_nighty', type='in'
    const deleteSql = `DELETE FROM stock_movements 
      WHERE vendor_id = ? AND category = ? AND type = 'in' 
      AND id NOT IN (
        SELECT MIN(id) FROM stock_movements 
        WHERE vendor_id = ? AND category = ? AND type = 'in'
      )`;
    const result = await query<any>(deleteSql, [3, 'shawl_nighty', 3, 'shawl_nighty']);
    console.log('Deleted duplicate rows, affected:', (result as any).affectedRows || result);

    // Verify remaining rows for this vendor/category
    const rows = await query<any[]>(
      `SELECT id, quantity FROM stock_movements WHERE vendor_id = ? AND category = ? AND type = 'in'`,
      [3, 'shawl_nighty']
    );
    console.log('Remaining rows for Sajna (vendor 3, shawl_nighty):', rows);
  } catch (err) {
    console.error('Cleanup error:', err);
  }
  process.exit();
}

clean();
