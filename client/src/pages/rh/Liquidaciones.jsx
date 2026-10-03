import { useAuth } from '../../context/AuthContext';
import { LiquidacionesScreen } from '../../components/rh/liquidaciones';

const Liquidaciones = () => {
    const { user } = useAuth();
    return <LiquidacionesScreen key={user?.company_id} companyId={user?.company_id} />;
};

export default Liquidaciones;
