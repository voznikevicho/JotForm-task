import React, { useState } from 'react';
import axios from 'axios';

const Form: React.FC = () => {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/form/submit', {
        q3_input3: { first: firstName, last: lastName },
        q4_input4: { full: phone }
      });
      console.log('Дані надіслано:', response.data);
    } catch (error) {
      console.error('Помилка при надсиланні:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Ім'я:
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
      </label>
      <label>
        Прізвище:
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </label>
      <label>
        Номер телефону:
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </label>
      <button type="submit">Надіслати</button>
    </form>
  );
}

export default Form;
