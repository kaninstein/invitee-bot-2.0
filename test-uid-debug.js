// Script para testar diretamente a API da Blofin
const { blofinService } = require('./dist/services/blofinService');

async function testBlofinApi() {
  console.log('🧪 TESTE DIRETO DA API BLOFIN - UID 23214869552');
  console.log('================================================');
  
  try {
    // Teste 1: Busca básica
    console.log('\n1️⃣ TESTE: Informações básicas do afiliado');
    const basicInfo = await blofinService.getAffiliateBasicInfo();
    console.log(`📊 Resposta básica: code=${basicInfo.code}, message=${basicInfo.msg}`);
    
    // Teste 2: Busca todos os convidados
    console.log('\n2️⃣ TESTE: Buscar todos os convidados (limit=500)');
    const allInvitees = await blofinService.getDirectInvitees({ limit: 500 });
    console.log(`📊 Total de convidados: ${allInvitees.data?.length || 0}`);
    
    if (allInvitees.data && allInvitees.data.length > 0) {
      console.log('\n👥 TODOS OS UIDS ENCONTRADOS:');
      allInvitees.data.forEach((user, index) => {
        console.log(`${index + 1}. UID: ${user.uid} | Email: ${user.email || 'N/A'} | RegTime: ${user.regTime || 'N/A'}`);
      });
      
      // Verificar se o UID procurado está na lista
      const targetUid = '23214869552';
      const foundUser = allInvitees.data.find(u => u.uid === targetUid);
      if (foundUser) {
        console.log(`\n✅ UID ${targetUid} ENCONTRADO\!`);
        console.log(`📋 Dados: ${JSON.stringify(foundUser, null, 2)}`);
      } else {
        console.log(`\n❌ UID ${targetUid} NÃO ENCONTRADO na lista de ${allInvitees.data.length} usuários`);
      }
    } else {
      console.log('❌ Nenhum convidado encontrado\!');
    }
    
    // Teste 3: Busca específica pelo UID problemático
    console.log('\n3️⃣ TESTE: Busca específica pelo UID 23214869552');
    const specificSearch = await blofinService.getDirectInvitees({ uid: '23214869552', limit: 1 });
    console.log(`📊 Busca específica: code=${specificSearch.code}, length=${specificSearch.data?.length || 0}`);
    if (specificSearch.data && specificSearch.data.length > 0) {
      console.log(`📋 Dados encontrados: ${JSON.stringify(specificSearch.data[0], null, 2)}`);
    }
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
  }
}

testBlofinApi().then(() => {
  console.log('\n🏁 TESTE CONCLUÍDO');
  process.exit(0);
}).catch(err => {
  console.error('💥 ERRO FATAL:', err);
  process.exit(1);
});