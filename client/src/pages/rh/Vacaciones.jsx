import { useAuth } from '../../context/AuthContext';
import { VacacionesScreen } from '../../components/rh/vacaciones';

const Vacaciones = () => {
    const { user } = useAuth();
    return <VacacionesScreen key={user?.company_id} companyId={user?.company_id} />;
};

export default Vacaciones;
