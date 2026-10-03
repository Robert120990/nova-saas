import { useAuth } from '../../context/AuthContext';
import Quincena25Screen from '../../components/rh/quincena25/Quincena25Screen';

const Quincena25 = () => {
    const { user } = useAuth();
    return <Quincena25Screen key={user?.company_id} companyId={user?.company_id} />;
};

export default Quincena25;
