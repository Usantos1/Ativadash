// PÁGINA DE TESTE SIMPLES - AUTENTICAÇÃO POSTGRESQL
import React from 'react';

const TestAuth = () => {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Arial' }}>
      <h1 style={{ color: 'green', fontSize: '48px' }}>✅ FUNCIONANDO!</h1>
      <h2>Página de Teste - Autenticação PostgreSQL</h2>
      <p style={{ fontSize: '18px', marginTop: '20px' }}>
        Se você está vendo isso, a rota /test-auth está funcionando!
      </p>
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '10px' }}>
        <p><strong>API URL:</strong> {import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api'}</p>
        <button 
          onClick={async () => {
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';
            try {
              const response = await fetch(`${apiUrl}/health`);
              const data = await response.json();
              alert('✅ API OK!\n\n' + JSON.stringify(data, null, 2));
            } catch (error: any) {
              alert('❌ ERRO na API:\n\n' + error.message);
            }
          }}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Testar Conexão com API
        </button>
      </div>
    </div>
  );
};

export default TestAuth;



