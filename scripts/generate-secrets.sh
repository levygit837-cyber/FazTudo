#!/bin/bash
# ============================================
# Script para gerar segredos seguros
# para deploy do FazTudo em produção
# ============================================

set -e

echo "🔐 Gerador de Segredos - FazTudo"
echo "=================================="
echo ""

# Verificar se openssl está instalado
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL não encontrado. Instale-o primeiro:"
    echo "   Ubuntu/Debian: sudo apt-get install openssl"
    echo "   macOS: brew install openssl"
    exit 1
fi

echo "✅ OpenSSL encontrado"
echo ""

# Função para gerar segredo
generate_secret() {
    local bytes=$1
    openssl rand -hex "$bytes"
}

echo "📋 Segredos Gerados:"
echo "===================="
echo ""

JWT_SECRET=$(generate_secret 32)
echo "JWT_SECRET (256 bits):"
echo "$JWT_SECRET"
echo ""

JWT_ACCESS_SECRET=$(generate_secret 32)
echo "JWT_ACCESS_SECRET (256 bits):"
echo "$JWT_ACCESS_SECRET"
echo ""

JWT_REFRESH_SECRET=$(generate_secret 32)
echo "JWT_REFRESH_SECRET (256 bits):"
echo "$JWT_REFRESH_SECRET"
echo ""

MFA_ENCRYPTION_KEY=$(generate_secret 16)
echo "MFA_ENCRYPTION_KEY (128 bits):"
echo "$MFA_ENCRYPTION_KEY"
echo ""

HEALTH_AUTH_TOKEN=$(generate_secret 24)
echo "HEALTH_AUTH_TOKEN (192 bits):"
echo "$HEALTH_AUTH_TOKEN"
echo ""

echo "=================================="
echo ""
echo "💡 Como usar:"
echo "   1. Copie cada valor acima"
echo "   2. Cole nas variáveis de ambiente do Render"
echo "   3. NUNCA commit estes valores no git!"
echo ""
echo "🚀 Próximo passo: execute 'cat DEPLOY.md' para o guia completo"
