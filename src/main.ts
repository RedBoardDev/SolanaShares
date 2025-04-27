import { DBRepository } from './repositories/database-repository';
import { Pool } from './services/pool';

const repo = new DBRepository('db.json');
const pool = new Pool(repo);

console.log('\n=== Scénario avec données réel (wallet before/added/after) ===\n');

// 1️⃣ Dépôts initiaux
pool.deposit('Alice', 100);
pool.deposit('Bob', 200);
pool.printSummary();

// 2️⃣ Trade #1 (20% gain)
const before1 = repo.getDB().cash; // e.g. 300
const added1 = before1 * 0.4; // 40% du wallet
pool.openPosition(before1, added1);
const after1 = before1 + added1 * 0.2; // +20% sur la position
pool.closePosition(after1);
pool.printSummary();

// 3️⃣ Stats post-Trade #1
console.log('\n--- Stats mid Trade #1 ---');
console.log(pool.getUserStats('Alice'));
console.log(pool.getUserStats('Bob'));

// 4️⃣ Carol dépose 150$
pool.deposit('Carol', 150);
pool.printSummary();

// 5️⃣ Trade #2 (–10% loss)
const before2 = repo.getDB().cash;
const added2 = before2 * 0.4;
pool.openPosition(before2, added2);
const after2 = before2 + added2 * -0.1; // –10% sur la position
pool.closePosition(after2);
pool.printSummary();

// 6️⃣ Bob retire la moitié
const bobHalf = repo.getDB().users.Bob.shares / 2;
pool.withdraw('Bob', bobHalf);
pool.printSummary();

// 7️⃣ Dave dépose 300$
pool.deposit('Dave', 300);
pool.printSummary();

// 8️⃣ Trade #3 (+5% gain)
const before3 = repo.getDB().cash;
const added3 = before3 * 0.4;
pool.openPosition(before3, added3);
const after3 = before3 + added3 * 0.05; // +5% sur la position
pool.closePosition(after3);
pool.printSummary();

// 9️⃣ Alice retire 50 shares
const aliceAvail = repo.getDB().users.Alice.shares;
pool.withdraw('Alice', Math.min(50, aliceAvail));
pool.printSummary();

// 🔟 Dave retire tout
const daveAll = repo.getDB().users.Dave.shares;
pool.withdraw('Dave', daveAll);
pool.printSummary();

// 📊 Stats finales
console.log('\n=== Stats finales ===');
for (const u of ['Alice', 'Bob', 'Carol', 'Dave']) {
  console.log(pool.getUserStats(u));
}
