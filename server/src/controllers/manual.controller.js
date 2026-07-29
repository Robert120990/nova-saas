const fs = require('fs');
const path = require('path');

const manualDir = path.resolve(__dirname, '../../manual');
const indexPath = path.join(manualDir, 'index.json');

const getIndex = async (req, res) => {
  try {
    if (!fs.existsSync(indexPath)) {
      return res.json({ data: [], total: 0 });
    }
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    res.json({ data: index, total: index.length });
  } catch (error) {
    res.status(500).json({ message: 'Error al leer el manual', error: error.message });
  }
};

const getSection = async (req, res) => {
  try {
    const { section } = req.params;

    if (!fs.existsSync(indexPath)) {
      return res.status(404).json({ message: 'Índice del manual no encontrado' });
    }
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const entry = index.find(s => s.id === section);
    if (!entry) {
      return res.status(404).json({ message: `Sección "${section}" no encontrada` });
    }

    const filePath = path.join(manualDir, entry.file);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(manualDir)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ message: `Archivo "${entry.file}" no encontrado` });
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    res.json({ data: { id: entry.id, label: entry.label, content } });
  } catch (error) {
    res.status(500).json({ message: 'Error al leer la sección', error: error.message });
  }
};

module.exports = { getIndex, getSection };
