import fs from 'fs';

let content = fs.readFileSync('src/services/storage.ts', 'utf-8');

// Replace synchronous gets with async fetch calls.
const authHeader = `
  const getAuthHeaders = () => {
    const token = localStorage.getItem('fcbv_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    };
  };
`;

content = content.replace('export const StorageService = {', `
const getAuthHeaders = () => {
  const token = localStorage.getItem('fcbv_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${token}\`
  };
};

export const StorageService = {
`);

// Example replacement for getEquipmentList
content = content.replace(
  /getEquipmentList\(\): Equipment\[\] \{[\s\S]*?return list;\n    \} catch \(e\) \{[\s\S]*?\}\n  \},/,
  `async getEquipmentList(): Promise<Equipment[]> {
    try {
      const res = await fetch('/api/sync/equipments', { headers: getAuthHeaders() });
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (e) {
      console.error('Error', e);
      return [];
    }
  },`
);

content = content.replace(
  /saveEquipmentList\(list: Equipment\[\]\): void \{[\s\S]*?\}\n  \},/,
  `async saveEquipmentList(list: Equipment[]): Promise<void> {
    try {
      await fetch('/api/sync/equipments', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(list)
      });
    } catch (e) {
      console.error('Error', e);
    }
  },`
);

// We need to do this for all get/save methods.
// To avoid messy regex, it's safer to completely replace the storage service methods manually in a script.

