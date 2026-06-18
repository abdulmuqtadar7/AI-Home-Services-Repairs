import { CustomerForm } from "@/components/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New customer</h1>
        <p className="mt-1 text-sm text-slate-500">Add a customer record.</p>
      </div>
      <div className="max-w-xl">
        <CustomerForm />
      </div>
    </div>
  );
}
