-- CreateIndex
CREATE INDEX "Ingredient_supplierId_idx" ON "Ingredient"("supplierId");

-- CreateIndex
CREATE INDEX "Ingredient_fornecedorSecundarioId_idx" ON "Ingredient"("fornecedorSecundarioId");

-- CreateIndex
CREATE INDEX "ProductIngredient_ingredientId_idx" ON "ProductIngredient"("ingredientId");
