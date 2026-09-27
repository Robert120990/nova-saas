

import EggAddTarimasModal from '../EggAddTarimasModal';


export default function ProductionContent({ model }) {
    const { setScannerModalOpen, setTarimaSearchPickerOpen, rawMaterials, setScannerContext, addTarimasModal, setAddTarimasModal, handleAddSpecificTarimaToAddModal, handleLoadAllAvailableTarimasToAddModal, handleUpdateTarimaBoxesInAddModal, handleUpdateTarimaLbsInAddModal, handleRemoveTarimaFromAddModal, handleManualTarimaDigitize, handleAddTarimasSubmit } = model;

    return (<EggAddTarimasModal
                isOpen={addTarimasModal.isOpen}
                onClose={() => setAddTarimasModal(prev => ({ ...prev, isOpen: false }))}
                addTarimasModal={addTarimasModal}
                setAddTarimasModal={setAddTarimasModal}
                rawMaterials={rawMaterials}
                onOpenScanner={() => {
                    setScannerContext('add_tarimas');
                    setScannerModalOpen(true);
                }}
                onOpenTarimaSearchPicker={() => setTarimaSearchPickerOpen(true)}
                handleManualTarimaDigitize={handleManualTarimaDigitize}
                handleAddTarimasSubmit={handleAddTarimasSubmit}
                handleLoadAllAvailableTarimasToAddModal={handleLoadAllAvailableTarimasToAddModal}
                handleAddSpecificTarimaToAddModal={handleAddSpecificTarimaToAddModal}
                handleRemoveTarimaFromAddModal={handleRemoveTarimaFromAddModal}
                handleUpdateTarimaBoxesInAddModal={handleUpdateTarimaBoxesInAddModal}
                handleUpdateTarimaLbsInAddModal={handleUpdateTarimaLbsInAddModal}
            />);
}
