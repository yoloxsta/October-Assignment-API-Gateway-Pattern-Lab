# Terraform - EC2 Instance for Kong API Gateway

This Terraform configuration creates an EC2 instance with a security group for running Kong API Gateway and microservices.

## Architecture - Hybrid Style

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS VPC (Existing)                           │
│                    vpc-1d815474                                 │
│                                                                 │
│  ┌─────────────────────────────┐   ┌─────────────────────────┐│
│  │  Kong Security Group        │   │  Common Servers SG      ││
│  │  (Special Server)           │   │  (Dynamic - Multiple)   ││
│  │  - Port 22   (SSH)          │   │  - Port 22   (SSH)      ││
│  │  - Port 80   (HTTP)         │   │  - Port 80   (HTTP)     ││
│  │  - Port 443  (HTTPS)        │   │  - Port 443  (HTTPS)    ││
│  │  - Port 3000 (Frontend)     │   │  - Custom ports per     ││
│  │  - Port 8000 (Kong)         │   │    server               ││
│  │  - Port 8001 (Kong Admin)   │   └─────────────────────────┘│
│  │  - Port 8443 (Kong SSL)     │            │                 │
│  │  - Port 1337 (Konga)        │            ▼                 │
│  └─────────────────────────────┘   ┌─────────────────────────┐│
│            │                        │  Common Server EC2s     ││
│            ▼                        │  (Dynamic - Add more    ││
│  ┌─────────────────────────────┐   │   in terraform.tfvars)  ││
│  │  Kong API Gateway EC2       │   │                         ││
│  │  (Special - Custom Config)  │   │  • web-server-1         ││
│  │  - t3.micro                 │   │  • web-server-2         ││
│  │  - Ubuntu 26.04 LTS         │   │  • app-server           ││
│  │  - 8 GB gp3 volume          │   │  • ... (add more!)      ││
│  │  - Key: soetintaung         │   │                         ││
│  │  - Special tags             │   │  - t3.micro each        ││
│  └─────────────────────────────┘   │  - Ubuntu 26.04 LTS     ││
│                                    │  - 8 GB gp3 volume      ││
│                                    │  - Key: soetintaung     ││
│                                    └─────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Benefits of Hybrid Style:
✅ Special Servers (Kong) → Explicit modules for custom config
✅ Common Servers (Web)   → Dynamic for_each, easy to add more
✅ Best of both worlds    → Flexibility + Scalability
```

## Prerequisites

1. **AWS CLI** installed and configured
2. **Terraform** installed (v1.0+)
3. **AWS credentials profile**: `music` (in `~/.aws/credentials`)
4. **Existing VPC**: `vpc-1d815474`
5. **Existing Key Pair**: `soetintaung` (download the .pem file)

## Files Structure (Modular Architecture)

```
Terraform/
├── main.tf                  # Root configuration (uses modules)
├── variables.tf             # Root variable definitions
├── outputs.tf               # Root output values
├── terraform.tfvars.example # Example variables file
├── README.md                # This file
└── modules/                 # Reusable modules
    ├── security-group/
    │   ├── main.tf         # Security group resources
    │   ├── variables.tf    # Module variables
    │   ├── outputs.tf      # Module outputs
    │   └── README.md       # Module documentation
    └── ec2/
        ├── main.tf         # EC2 instance resources
        ├── variables.tf    # Module variables
        ├── outputs.tf      # Module outputs
        └── README.md       # Module documentation
```

## Quick Start

### 1. Create terraform.tfvars

```bash
cd Terraform
cp terraform.tfvars.example terraform.tfvars
```

The configuration uses your existing AWS profile `music` from `~/.aws/credentials`, so no need to hardcode access keys!

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Preview Changes

```bash
terraform plan
```

### 4. Apply Configuration

```bash
terraform apply
```

Type `yes` when prompted.

### 5. View Outputs

After successful apply, Terraform will display:

```
instance_id = i-xxxxxxxxxx
public_ip = 12.34.56.78
public_dns = ec2-12-34-56-78.us-east-2.compute.amazonaws.com
security_group_id = sg-xxxxxxxxxx
ssh_command = ssh -i /path/to/soetintaung.pem ubuntu@12.34.56.78
instance_url = http://12.34.56.78
```

### 6. SSH into Instance

```bash
ssh -i /path/to/soetintaung.pem ubuntu@<PUBLIC_IP>
```

## Configuration Options

### Change Instance Type

Edit `terraform.tfvars`:

```hcl
instance_type = "t3.medium"  # 2 vCPU, 4 GB RAM
```

### Add More Ports

```hcl
allowed_ports = [22, 80, 443, 3000, 8000, 8001, 8443, 1337, 9000]
```

### Restrict SSH Access

For better security, restrict SSH to your IP only:

```hcl
allowed_ssh_cidr = "203.0.113.50/32"  # Your IP
```

Find your IP: `curl ifconfig.me`

## Update Deployment Guide

After creating the EC2 instance, update `ec2-app-kong.md`:

1. Replace `<YOUR-EC2-PUBLIC-IP>` with the output from `terraform output public_ip`
2. Follow the deployment steps in `ec2-app-kong.md`

## Clean Up

To destroy all resources:

```bash
terraform destroy
```

Type `yes` when prompted.

## Module Architecture Benefits

✅ **Reusability** - Use modules in other projects  
✅ **Separation of concerns** - Each module has a single responsibility  
✅ **Easy maintenance** - Update modules independently  
✅ **Testability** - Test modules in isolation  
✅ **Standardization** - Follow Terraform best practices  

## Security Recommendations

1. **Never commit `terraform.tfvars`** to git (contains credentials)
2. **Restrict SSH access** to your IP address
3. **Use IAM roles** instead of access keys for production
4. **Enable encryption** for root volume in production
5. **Use Elastic IP** for stable public IP

## Costs

Estimated monthly cost (us-east-2):

- **t3.micro**: ~$8.50/month (free tier eligible)
- **t3.medium**: ~$30.40/month
- **8 GB gp3 storage**: ~$0.80/month
- **Elastic IP**: Free when attached to running instance

Total: ~$9-10/month (free tier) or ~$31/month (t3.medium)

## Troubleshooting

### Key pair not found

Make sure you have the key pair `soetintaung` in the correct region (us-east-2).

### Subnet not found

Verify the subnet `subnet-9162c5f8` exists in your VPC.

### Invalid credentials

Check your AWS access key and secret key in `terraform.tfvars`.

### Instance not accessible

1. Check security group rules
2. Verify the instance is running: `terraform show`
3. Check instance status in AWS Console

## Next Steps

After creating the EC2 instance:

1. SSH into the instance
2. Install Docker and Docker Compose
3. Clone the project repository
4. Follow `ec2-app-kong.md` for deployment

## Reference

- **VPC ID**: vpc-1d815474
- **Subnet ID**: subnet-9162c5f8 (us-east-2a)
- **AMI**: ami-0e5497a77ef21b5ac (Ubuntu 26.04 LTS)
- **Key Pair**: soetintaung
