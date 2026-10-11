# Terraform configuration - Hybrid Style
# Uses modular architecture for reusability

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration (optional - uncomment to use)
  # backend "local" {
  #   path = "terraform.tfstate"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

# ============================================
# COMMON SERVERS - Dynamic (for similar servers)
# ============================================
module "common_sg" {
  source = "./modules/security-group"

  for_each = var.common_servers

  name             = "${each.key}-sg"
  description      = "Security group for ${each.key}"
  vpc_id           = var.vpc_id
  allowed_ports    = each.value.allowed_ports
  allowed_ssh_cidr = var.allowed_ssh_cidr

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Server      = each.key
    ManagedBy   = "terraform"
  }
}

module "common_ec2" {
  source = "./modules/ec2"

  for_each = var.common_servers

  name           = each.key
  ami            = var.ami_id
  instance_type  = each.value.instance_type
  key_name       = var.key_name
  subnet_id      = var.subnet_id

  vpc_security_group_ids = [module.common_sg[each.key].security_group_id]

  associate_public_ip_address = true
  root_volume_size            = each.value.root_volume_size
  root_volume_type            = "gp3"

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Role        = each.key
    ManagedBy   = "terraform"
  }
}

# ============================================
# SPECIAL SERVERS - Explicit (for unique configs)
# ============================================

# Kong API Gateway (Special - API Gateway with custom configuration)
module "kong_sg" {
  source = "./modules/security-group"

  name             = "${var.kong_instance_name}-sg"
  description      = "Security group for Kong API Gateway and microservices"
  vpc_id           = var.vpc_id
  allowed_ports    = var.kong_allowed_ports
  allowed_ssh_cidr = var.allowed_ssh_cidr

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Server      = "kong-api"
    Critical    = "true"
    ManagedBy   = "terraform"
  }
}

module "kong_ec2" {
  source = "./modules/ec2"

  name           = var.kong_instance_name
  ami            = var.ami_id
  instance_type  = var.kong_instance_type
  key_name       = var.key_name
  subnet_id      = var.subnet_id

  vpc_security_group_ids = [module.kong_sg.security_group_id]

  associate_public_ip_address = true
  root_volume_size            = var.kong_root_volume_size
  root_volume_type            = "gp3"

  tags = {
    Environment = "development"
    Project     = "api-gateway-lab"
    Role        = "api-gateway"
    Critical    = "true"
    ManagedBy   = "terraform"
  }
}
