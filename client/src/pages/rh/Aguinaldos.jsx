import { useAuth } from '../../context/AuthContext';
import { AguinaldosScreen } from '../../components/rh/aguinaldos';

const Aguinaldos = () => {
    const { user } = useAuth();
    return <AguinaldosScreen key={user?.company_id} companyId={user?.company_id} />;
};

export default Aguinaldos;
