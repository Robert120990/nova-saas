

import {
    EggCosteoCatalogTab
} from '../../costeo';


export default function CosteoPorLibraCatalogTab({ model }) {
    const { activeTab, cipItems, packagingItems, syncingPurchases, configs, setCipModal, setPackagingModal, setConfigModal, handleSyncPurchases, handleQuickApplyPackagingCost, handleQuickApplyCipCost, handleDeleteCipItem, handleDeletePackagingItem } = model;

    return (<>{activeTab === 'catalog' && (
                <EggCosteoCatalogTab
                    configs={configs}
                    setConfigModal={setConfigModal}
                    handleSyncPurchases={handleSyncPurchases}
                    syncingPurchases={syncingPurchases}
                    cipItems={cipItems}
                    setCipModal={setCipModal}
                    handleQuickApplyCipCost={handleQuickApplyCipCost}
                    handleDeleteCipItem={handleDeleteCipItem}
                    packagingItems={packagingItems}
                    setPackagingModal={setPackagingModal}
                    handleQuickApplyPackagingCost={handleQuickApplyPackagingCost}
                    handleDeletePackagingItem={handleDeletePackagingItem}
                />
            )}</>);
}
