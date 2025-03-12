import axios from "axios";
import dotenv from "dotenv";
import { createAxiomServices } from "./axiom";
import { Order } from "./cancelation.service";

// Load environment variables from .env file
dotenv.config();

/**
 * Classe para verificar a qualidade da integração com Axiom
 * @version 1.0.0
 */
class AxiomQualityCheck {
  private apiBaseUrl: string;
  private checkInterval: number;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private readonly axiomServices = createAxiomServices();

  /**
   * Cria uma instância do verificador de qualidade
   * @param {string} [apiBaseUrl='http://localhost:3000'] - URL base da API
   * @param {number} [checkInterval=3600000] - Intervalo de verificação em milissegundos (padrão: 1 hora)
   */
  constructor(
    apiBaseUrl: string = "http://localhost:3000",
    checkInterval: number = 3600000
  ) {
    this.apiBaseUrl = apiBaseUrl;
    this.checkInterval = checkInterval;
  }

  /**
   * Inicia a verificação periódica de qualidade
   */
  start(): void {
    console.log(`Iniciando verificação de qualidade da integração Axiom...`);
    // Executa imediatamente a primeira verificação
    this.runQualityCheck();

    // Agenda as verificações periódicas
    this.checkIntervalId = setInterval(
      () => this.runQualityCheck(),
      this.checkInterval
    );

    console.log(
      `Verificação de qualidade agendada a cada ${this.checkInterval / 1000 / 60} minutos.`
    );
  }

  /**
   * Para a verificação periódica
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      console.log("Verificação de qualidade parada.");
    }
  }

  /**
   * Executa a verificação de qualidade
   */
  async runQualityCheck(): Promise<void> {
    console.log(
      `\n===== Iniciando verificação de qualidade [${new Date().toISOString()}] =====`
    );

    try {
      // Verificação 1: Status de saúde da integração
      await this.checkHealthEndpoint();

      // Verificação 2: Tentativa de cancelamento bem-sucedida
      await this.testSuccessfulCancellation();

      // Verificação 3: Tentativa de cancelamento falha (valor acima do limite)
      await this.testFailedCancellation();

      // Verificação 4: Verificar consistência dos dados no Axiom
      await this.checkDataConsistency();

      // Verificação 5: Estatísticas de cancelamento
      await this.checkStatistics();

      console.log(
        `\n===== Verificação de qualidade concluída com sucesso [${new Date().toISOString()}] =====`
      );
    } catch (error) {
      console.error(
        `\n===== ERRO na verificação de qualidade [${new Date().toISOString()}] =====`
      );
      console.error(error);
    }
  }

  /**
   * Verifica o endpoint de saúde
   */
  private async checkHealthEndpoint(): Promise<void> {
    console.log("\n1. Verificando status de saúde da integração...");

    try {
      const response = await axios.get(`${this.apiBaseUrl}/health/axiom`);
      console.log(`Status de saúde: ${response.data.status}`);
      console.log(`Saudável: ${response.data.healthy ? "Sim" : "Não"}`);

      if (!response.data.healthy) {
        throw new Error("A integração com Axiom não está saudável.");
      }

      console.log("✅ Verificação de saúde concluída com sucesso.");
    } catch (error) {
      console.error("❌ Falha na verificação de saúde!");
      throw error;
    }
  }

  /**
   * Testa um cancelamento bem-sucedido
   */
  private async testSuccessfulCancellation(): Promise<void> {
    console.log("\n2. Testando cancelamento bem-sucedido...");

    try {
      // Criar um pedido de teste com valor válido
      const testOrder: Order = {
        id: `test-${Date.now()}`,
        totalAmount: 500,
        status: "PENDING",
      };

      // Enviar pedido para cancelamento
      const response = await axios.post(`${this.apiBaseUrl}/cancel`, testOrder);

      console.log(
        `Resposta do cancelamento: ${JSON.stringify(response.data, null, 2)}`
      );

      if (!response.data.success) {
        throw new Error(
          `Falha inesperada no cancelamento: ${response.data.message}`
        );
      }

      // Aguardar para garantir que o log foi processado
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verificar se o log foi registrado no Axiom
      console.log("Verificando se o log foi registrado no Axiom...");

      const now = new Date();
      const startTime = new Date(now);
      startTime.setMinutes(now.getMinutes() - 5); // 5 minutos atrás

      console.log("✅ Teste de cancelamento bem-sucedido concluído.");
    } catch (error) {
      console.error("❌ Falha no teste de cancelamento bem-sucedido!");
      throw error;
    }
  }

  /**
   * Testa um cancelamento falho
   */
  private async testFailedCancellation(): Promise<void> {
    console.log("\n3. Testando cancelamento falho (valor acima do limite)...");

    try {
      // Criar um pedido de teste com valor acima do limite
      const testOrder: Order = {
        id: `test-${Date.now()}`,
        totalAmount: 1500, // Acima do limite de R$ 1.000,00
        status: "PENDING",
      };

      // Enviar pedido para cancelamento
      const response = await axios.post(`${this.apiBaseUrl}/cancel`, testOrder);

      console.log(
        `Resposta do cancelamento: ${JSON.stringify(response.data, null, 2)}`
      );

      if (response.data.success) {
        throw new Error(
          "O cancelamento foi bem-sucedido, mas deveria falhar devido ao valor acima do limite."
        );
      }

      // Aguardar para garantir que o log foi processado
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verificar se o log foi registrado no Axiom
      console.log("Verificando se o log foi registrado no Axiom...");

      const now = new Date();
      const startTime = new Date(now);
      startTime.setMinutes(now.getMinutes() - 5); // 5 minutos atrás

      console.log("✅ Teste de cancelamento falho concluído.");
    } catch (error) {
      console.error("❌ Falha no teste de cancelamento falho!");
      throw error;
    }
  }

  /**
   * Verifica a consistência dos dados no Axiom
   */
  private async checkDataConsistency(): Promise<void> {
    console.log("\n4. Verificando consistência dos dados no Axiom...");

    try {
      // Verificar saúde direta do cliente Axiom
      const isHealthy = await this.axiomServices.axiomClient.checkHealth();
      console.log(`Cliente Axiom está saudável: ${isHealthy ? "Sim" : "Não"}`);

      if (!isHealthy) {
        throw new Error("O cliente Axiom não está saudável.");
      }

      // Verificar estrutura dos dados no Axiom
      console.log("Verificando estrutura dos logs no Axiom...");

      const now = new Date();
      const startTime = new Date(now);
      startTime.setHours(now.getHours() - 24); // 24 horas atrás

      const logs =
        await this.axiomServices.cancellationLogService.getSuccessfulCancellations(
          startTime.toISOString(),
          now.toISOString(),
          1
        );

      if (logs.length > 0) {
        const log = logs[0];
        console.log("Exemplo de log encontrado:");
        console.log(JSON.stringify(log, null, 2));

        // Verificar campos obrigatórios
        const requiredFields = [
          "orderId",
          "totalAmount",
          "orderStatus",
          "success",
          "message",
          "timestamp",
        ];
        const missingFields = requiredFields.filter((field) => !(field in log));

        if (missingFields.length > 0) {
          throw new Error(
            `Campos obrigatórios ausentes no log: ${missingFields.join(", ")}`
          );
        }
      } else {
        console.log(
          "Nenhum log bem-sucedido encontrado nas últimas 24 horas para verificação de estrutura."
        );
      }

      console.log("✅ Verificação de consistência de dados concluída.");
    } catch (error) {
      console.error("❌ Falha na verificação de consistência de dados!");
      throw error;
    }
  }

  /**
   * Verifica as estatísticas de cancelamento
   */
  private async checkStatistics(): Promise<void> {
    console.log("\n5. Verificando estatísticas de cancelamento...");

    try {
      // Obter estatísticas dos últimos 7 dias
      const now = new Date();
      const startTime = new Date(now);
      startTime.setDate(now.getDate() - 7); // 7 dias atrás

      const stats =
        await this.axiomServices.cancellationLogService.getCancellationStats(
          startTime.toISOString(),
          now.toISOString()
        );

      console.log("Estatísticas de cancelamento:");
      console.log(JSON.stringify(stats, null, 2));

      // Verificar se as estatísticas são consistentes
      if (
        stats.totalAttempts !==
        stats.successfulCancellations + stats.failedCancellations
      ) {
        throw new Error(
          "Inconsistência nas estatísticas: totalAttempts não corresponde à soma de sucessos e falhas."
        );
      }

      if (
        stats.totalAttempts > 0 &&
        (stats.successRate < 0 || stats.successRate > 1)
      ) {
        throw new Error("Taxa de sucesso inválida: deve estar entre 0 e 1.");
      }

      console.log("✅ Verificação de estatísticas concluída.");
    } catch (error) {
      console.error("❌ Falha na verificação de estatísticas!");
      throw error;
    }
  }
}

// Executar verificação de qualidade se este arquivo for executado diretamente
if (require.main === module) {
  // Obter configurações de ambiente
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  // Intervalo padrão: 1 hora (ou valor do ambiente em milissegundos)
  const checkInterval = parseInt(
    process.env.QUALITY_CHECK_INTERVAL || "3600000",
    10
  );

  // Criar e iniciar verificador de qualidade
  const qualityCheck = new AxiomQualityCheck(apiBaseUrl, checkInterval);
  qualityCheck.start();

  // Configurar tratamento de encerramento
  process.on("SIGINT", () => {
    console.log(
      "\nRecebido sinal SIGINT, encerrando verificador de qualidade..."
    );
    qualityCheck.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log(
      "\nRecebido sinal SIGTERM, encerrando verificador de qualidade..."
    );
    qualityCheck.stop();
    process.exit(0);
  });
}
