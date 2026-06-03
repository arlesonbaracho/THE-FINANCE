# Evolution API Setup

## Variáveis de ambiente

Adicione ao `.env`:

```env
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_aqui
EVOLUTION_INSTANCE=the-finance
EVOLUTION_SERVER_URL=https://seu-dominio.com
WHATSAPP_WEBHOOK_SECRET=secret_para_validar_webhook
```

## Subir o container

```bash
docker compose -f docker-compose.evolution.yml up -d
```

## Conectar o número

1. Acesse `{EVOLUTION_SERVER_URL}/manager`
2. Crie uma instância chamada `the-finance` (igual a `EVOLUTION_INSTANCE`)
3. Escaneie o QR Code com o WhatsApp do número do sistema
4. Aguarde o status mudar para "Open"

## Verificar conexão

```bash
curl -H "apikey: sua_chave" http://localhost:8080/instance/connectionState/the-finance
# Esperado: {"instance":{"instanceName":"the-finance","state":"open"}}
```

## Webhook em desenvolvimento

Em dev use ngrok para expor localhost:
```bash
ngrok http 3000
# Configure NEXT_PUBLIC_APP_URL com a URL HTTPS do ngrok
```
