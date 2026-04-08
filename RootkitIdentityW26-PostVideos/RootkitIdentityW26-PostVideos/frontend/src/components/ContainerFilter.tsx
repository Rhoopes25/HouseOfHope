import { useEffect, useState } from 'react';
import { getContainerTypes } from '../lib/rootbeerApi';
import './ContainerFilter.css';

function ContainerFilter({
  selectedContainers,
  setSelectedContainers,
}: {
  selectedContainers: string[];
  setSelectedContainers: (containers: string[]) => void;
}) {
  const [containers, setContainers] = useState<string[]>([]);

  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const data = await getContainerTypes();
        setContainers(data);
      } catch (error) {
        console.error('Error fetching container types', error);
      }
    };

    fetchContainers();
  }, []);

  function handleCheckboxChange({ target }: { target: HTMLInputElement }) {
    const updatedContainers = selectedContainers.includes(target.value)
      ? selectedContainers.filter((container) => container !== target.value)
      : [...selectedContainers, target.value];

    setSelectedContainers(updatedContainers);
  }

  return (
    <div className="container-filter">
      <h5>Container Types</h5>
      <div className="container-list">
        {containers.map((container) => (
          <div key={container} className="container-item">
            <input
              type="checkbox"
              id={container}
              name={container}
              value={container}
              className="container-checkbox"
              onChange={handleCheckboxChange}
              checked={selectedContainers.includes(container)}
            />
            <label htmlFor={container}>{container}</label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ContainerFilter;
