// Versão SIMPLES para testar se a rota funciona
import React from 'react';

const TestAuthSimple = () => {
  console.log('🧪 TestAuthSimple component RENDERED');
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🧪 TESTE DE ROTA - FUNCIONANDO!</h1>
      <p>Se você está vendo isso, a rota /test-auth-simple está funcionando!</p>
      <p>API URL: {import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api'}</p>
      <button onClick={() => {
        fetch(`${import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api'}/health`)
          .then(r => r.json())
          .then(data => alert('API OK: ' + JSON.stringify(data)))
          .catch(err => alert('API ERRO: ' + err.message));
      }}>
        Testar API
      </button>
    </div>
  );
};

export default TestAuthSimple;



