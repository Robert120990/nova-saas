import React from 'react';

const VariableBadge = ({ name, onClick }) => {
  return (
    <button
      type="button"
      onClick={() => onClick?.(name)}
      className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[11px] font-mono font-bold text-indigo-700 transition-colors cursor-pointer"
      title="Haz clic para insertar"
    >
      {'{{'}{name}{'}}'}
    </button>
  );
};

export default VariableBadge;
