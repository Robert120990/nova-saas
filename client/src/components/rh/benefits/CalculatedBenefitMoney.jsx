import Money from '../../ui/Money';

const CalculatedBenefitMoney = ({ ready, value, className, pendingText = 'Pendiente', pendingClassName = 'text-[11px] font-medium text-current opacity-80' }) => {
    if (!ready) return <span className={pendingClassName}>{pendingText}</span>;
    return <Money value={value} className={className} />;
};

export default CalculatedBenefitMoney;
