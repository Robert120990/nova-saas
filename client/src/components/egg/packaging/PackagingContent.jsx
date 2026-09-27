

import {
    EggEditPackagingModal
} from './';


export default function PackagingContent({ model }) {
    const { batches, isEditModalOpen, setIsEditModalOpen, editingPackaging, setEditingPackaging, packagingForm, setPackagingForm, isSubmitting, canEditLots, handleReopenBatchPackaging, handleEditSubmit } = model;

    return (<EggEditPackagingModal
                isOpen={isEditModalOpen && !!editingPackaging}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingPackaging(null);
                }}
                packaging={editingPackaging}
                packagingForm={packagingForm}
                setPackagingForm={setPackagingForm}
                onSubmit={handleEditSubmit}
                isSubmitting={isSubmitting}
                canEditLots={canEditLots}
                batches={batches}
                onReopenPackaging={handleReopenBatchPackaging}
            />);
}
