// Testar ambos os UIDs para entender as diferenças
const { blofinService } = require('./dist/services/blofinService');

async function testBothUids() {
  console.log('🧪 TESTE COMPARATIVO DOS UIDs');
  console.log('============================');
  
  const uid1 = '23176549948'; // UID que existe
  const uid2 = '23214869552'; // UID que não encontra
  
  try {
    console.log('\n1️⃣ TESTE: Busca direta por UID existente');
    const result1 = await blofinService.getDirectInvitees({ uid: uid1, limit: 10 });
    console.log(`📊 UID ${uid1}: code=${result1.code}, length=${result1.data?.length || 0}`);
    if (result1.data && result1.data.length > 0) {
      console.log(`📋 Dados: ${JSON.stringify(result1.data[0], null, 2)}`);
    }
    
    console.log('\n2️⃣ TESTE: Busca direta por UID problemático');
    const result2 = await blofinService.getDirectInvitees({ uid: uid2, limit: 10 });
    console.log(`📊 UID ${uid2}: code=${result2.code}, length=${result2.data?.length || 0}`);
    if (result2.data && result2.data.length > 0) {
      console.log(`📋 Dados: ${JSON.stringify(result2.data[0], null, 2)}`);
    }
    
    console.log('\n3️⃣ TESTE: Busca geral com diferentes parâmetros');
    
    // Teste com needEquity=false como na sua chamada
    const resultGeneral1 = await blofinService.getDirectInvitees({ needEquity: false, limit: 100 });
    console.log(`📊 Geral (needEquity=false): code=${resultGeneral1.code}, length=${resultGeneral1.data?.length || 0}`);
    
    // Teste sem needEquity
    const resultGeneral2 = await blofinService.getDirectInvitees({ limit: 100 });
    console.log(`📊 Geral (sem needEquity): code=${resultGeneral2.code}, length=${resultGeneral2.data?.length || 0}`);
    
    // Teste com range de tempo maior
    const now = Date.now();
    const begin = now - (30 * 24 * 60 * 60 * 1000); // 30 dias
    const resultGeneral3 = await blofinService.getDirectInvitees({ begin: begin.toString(), end: now.toString(), limit: 100 });
    console.log(`📊 Geral (30 dias): code=${resultGeneral3.code}, length=${resultGeneral3.data?.length || 0}`);
    
    if (resultGeneral3.data && resultGeneral3.data.length > 0) {
      console.log('\n👥 TODOS OS UIDs DOS ÚLTIMOS 30 DIAS:');
      resultGeneral3.data.forEach((user, index) => {
        const regDate = new Date(parseInt(user.registerTime)).toISOString();
        console.log(`${index + 1}. UID: ${user.uid} | RegTime: ${regDate} | Volume: ${user.totalTradingVolume}`);
      });
      
      // Verificar se o UID problemático está nesta lista
      const foundUser = resultGeneral3.data.find(u => u.uid === uid2);
      if (foundUser) {
        console.log(`\n✅ UID ${uid2} ENCONTRADO nos últimos 30 dias!`);
        console.log(`📋 Dados: ${JSON.stringify(foundUser, null, 2)}`);
      } else {
        console.log(`\n❌ UID ${uid2} ainda não encontrado mesmo nos últimos 30 dias`);
      }
    }
    
    console.log('\n4️⃣ TESTE: Verificação usando nossa função');
    console.log(`🔍 Verificando UID ${uid1} (existente):`);
    const verify1 = await blofinService.verifyUserByUid(uid1);
    console.log(`✅ Resultado: ${verify1}`);
    
    console.log(`🔍 Verificando UID ${uid2} (problemático):`);
    const verify2 = await blofinService.verifyUserByUid(uid2);
    console.log(`✅ Resultado: ${verify2}`);
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
  }
}

testBothUids().then(() => {
  console.log('\n🏁 TESTE COMPARATIVO CONCLUÍDO');
  process.exit(0);
}).catch(err => {
  console.error('💥 ERRO FATAL:', err);
  process.exit(1);
});